/**
 * @file erofs_api.c
 * @brief WebAssembly API wrapper for reading and extracting EROFS filesystem images using liberofs.
 *
 * This module exposes C functions to JavaScript via Emscripten to allow:
 * - Parsing an EROFS filesystem image superblock and traversing its directory hierarchy as JSON.
 * - Looking up and reading file contents or symlink target data from an EROFS image into memory.
 * - Freeing allocated buffers returned to WebAssembly callers.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <emscripten.h>
#include "erofs/internal.h"
#include "erofs/dir.h"
#include "erofs/io.h"

/**
 * @struct StrBuf
 * @brief Dynamic string buffer used for building JSON output.
 */
typedef struct {
    char *data;      /**< Pointer to heap-allocated string buffer. */
    size_t size;     /**< Current length of string in bytes (excluding null terminator). */
    size_t capacity; /**< Total allocated capacity in bytes. */
} StrBuf;

/**
 * @brief Initializes a dynamic string buffer.
 *
 * @param b Pointer to the StrBuf instance to initialize.
 */
static void buf_init(StrBuf *b) {
    b->capacity = 1024;
    b->size = 0;
    b->data = malloc(b->capacity);
    if (b->data) {
        b->data[0] = '\0';
    }
}

/**
 * @brief Appends a string with a given length to the dynamic buffer, reallocating if necessary.
 *
 * @param b Pointer to the dynamic buffer.
 * @param str Pointer to the string data to append.
 * @param len Length of the string data to append.
 */
static void buf_append_len(StrBuf *b, const char *str, size_t len) {
    if (!b->data) return;
    while (b->size + len + 1 > b->capacity) {
        b->capacity *= 2;
        char *new_data = realloc(b->data, b->capacity);
        if (!new_data) return;
        b->data = new_data;
    }
    memcpy(b->data + b->size, str, len);
    b->size += len;
    b->data[b->size] = '\0';
}

/**
 * @brief Appends a null-terminated string to the dynamic buffer.
 *
 * @param b Pointer to the dynamic buffer.
 * @param str Null-terminated string to append.
 */
static void buf_append(StrBuf *b, const char *str) {
    buf_append_len(b, str, strlen(str));
}

/**
 * @brief Appends a string as a JSON-escaped string literal enclosed in double quotes.
 *
 * @param b Pointer to the dynamic buffer.
 * @param str Pointer to the raw string.
 * @param len Length of the raw string.
 */
static void buf_append_escaped(StrBuf *b, const char *str, size_t len) {
    buf_append(b, "\"");
    for (size_t i = 0; i < len; i++) {
        char c = str[i];
        if (c == '"') buf_append(b, "\\\"");
        else if (c == '\\') buf_append(b, "\\\\");
        else if (c == '\b') buf_append(b, "\\b");
        else if (c == '\f') buf_append(b, "\\f");
        else if (c == '\n') buf_append(b, "\\n");
        else if (c == '\r') buf_append(b, "\\r");
        else if (c == '\t') buf_append(b, "\\t");
        else {
            char tmp[2] = {c, '\0'};
            buf_append(b, tmp);
        }
    }
    buf_append(b, "\"");
}

/**
 * @struct walk_dir_ctx
 * @brief Context structure passed during recursive EROFS directory iteration.
 */
struct walk_dir_ctx {
    struct erofs_dir_context ctx; /**< Underlying liberofs directory iteration context. */
    struct erofs_sb_info *sbi;    /**< Pointer to EROFS superblock information. */
    StrBuf *buf;                  /**< Dynamic buffer receiving the generated JSON. */
    const char *parent_path;      /**< Absolute path of the directory being iterated. */
    bool is_first;                /**< Flag indicating if the current entry is the first item in JSON object. */
};

static int walk_dir_cb(struct erofs_dir_context *ctx);

/**
 * @brief Recursively traverses an EROFS directory inode and serializes its children into JSON.
 *
 * @param sbi Pointer to EROFS superblock info.
 * @param dir_vi Pointer to directory inode.
 * @param parent_path Absolute path of the directory.
 * @param buf Output dynamic string buffer.
 */
static void walk_directory(struct erofs_sb_info *sbi, struct erofs_inode *dir_vi, const char *parent_path, StrBuf *buf) {
    buf_append(buf, "{");

    struct walk_dir_ctx wctx = {0};
    wctx.ctx.dir = dir_vi;
    wctx.ctx.cb = walk_dir_cb;
    wctx.sbi = sbi;
    wctx.buf = buf;
    wctx.parent_path = parent_path;
    wctx.is_first = true;

    erofs_iterate_dir(&wctx.ctx, false);

    buf_append(buf, "}");
}

/**
 * @brief Callback function invoked by liberofs for each directory entry.
 *
 * @param ctx Pointer to liberofs directory context.
 * @return 0 on success.
 */
static int walk_dir_cb(struct erofs_dir_context *ctx) {
    struct walk_dir_ctx *wctx = (struct walk_dir_ctx *)ctx;

    // Skip dot (.) and dotdot (..) directory references or empty names
    if (ctx->dot_dotdot || ctx->de_namelen == 0) {
        return 0;
    }

    if (!wctx->is_first) {
        buf_append(wctx->buf, ",");
    }
    wctx->is_first = false;

    // Append key name (child file/directory name)
    buf_append_escaped(wctx->buf, ctx->dname, ctx->de_namelen);
    buf_append(wctx->buf, ":");

    // Construct child absolute path
    char full_path[1024];
    if (strcmp(wctx->parent_path, "/") == 0) {
        snprintf(full_path, sizeof(full_path), "/%.*s", ctx->de_namelen, ctx->dname);
    } else {
        snprintf(full_path, sizeof(full_path), "%s/%.*s", wctx->parent_path, ctx->de_namelen, ctx->dname);
    }

    struct erofs_inode child_vi = { .sbi = wctx->sbi, .nid = ctx->de_nid };
    int ret = erofs_read_inode_from_disk(&child_vi);
    if (ret) {
        // Fallback for unreadable inode
        buf_append(wctx->buf, "{\"_size\":0,\"_mode\":0,\"_uid\":0,\"_gid\":0,\"_path\":");
        buf_append_escaped(wctx->buf, full_path, strlen(full_path));
        buf_append(wctx->buf, "}");
        return 0;
    }

    if (S_ISDIR(child_vi.i_mode) || ctx->de_ftype == EROFS_FT_DIR) {
        walk_directory(wctx->sbi, &child_vi, full_path, wctx->buf);
    } else {
        char meta_str[256];
        snprintf(meta_str, sizeof(meta_str), "{\"_size\":%llu,\"_mode\":%u,\"_uid\":%u,\"_gid\":%u,\"_path\":",
                 (unsigned long long)child_vi.i_size,
                 (unsigned int)child_vi.i_mode,
                 (unsigned int)child_vi.i_uid,
                 (unsigned int)child_vi.i_gid);
        buf_append(wctx->buf, meta_str);
        buf_append_escaped(wctx->buf, full_path, strlen(full_path));
        buf_append(wctx->buf, "}");
    }

    return 0;
}

/**
 * @brief Parses an EROFS filesystem image file and returns its hierarchical file tree as a JSON string.
 *
 * @param img_filename Path to the EROFS image file in Emscripten's virtual filesystem.
 * @return Pointer to heap-allocated JSON string, or NULL on error. Caller must free using erofs_free_buf().
 */
EMSCRIPTEN_KEEPALIVE
char *erofs_parse_tree(const char *img_filename) {
    struct erofs_sb_info sbi = {0};
    sbi.bdev.offset = 0;
    int ret = erofs_dev_open(&sbi, img_filename, O_RDONLY);
    if (ret) {
        return NULL;
    }

    ret = erofs_read_superblock(&sbi);
    if (ret) {
        erofs_dev_close(&sbi);
        return NULL;
    }

    if (erofs_sb_has_fragments(&sbi) && sbi.packed_nid > 0) {
        erofs_packedfile_init(&sbi, false);
    }

    struct erofs_inode root_vi = { .sbi = &sbi, .nid = sbi.root_nid };
    ret = erofs_read_inode_from_disk(&root_vi);
    if (ret) {
        erofs_dev_close(&sbi);
        return NULL;
    }

    StrBuf buf;
    buf_init(&buf);

    walk_directory(&sbi, &root_vi, "/", &buf);

    erofs_dev_close(&sbi);
    return buf.data;
}

/**
 * @brief Reads the contents of a specific file from an EROFS filesystem image.
 *
 * @param img_filename Path to the EROFS image file in Emscripten's virtual filesystem.
 * @param path Absolute path of the target file within the EROFS filesystem.
 * @param out_size Pointer to uint32_t where the size of the returned data buffer will be stored.
 * @return Pointer to heap-allocated byte buffer containing file data, or NULL on error.
 *         Caller must free using erofs_free_buf().
 */
EMSCRIPTEN_KEEPALIVE
uint8_t *erofs_read_file_data(const char *img_filename, const char *path, uint32_t *out_size) {
    struct erofs_sb_info sbi = {0};
    sbi.bdev.offset = 0;
    int ret = erofs_dev_open(&sbi, img_filename, O_RDONLY);
    if (ret) {
        return NULL;
    }

    ret = erofs_read_superblock(&sbi);
    if (ret) {
        erofs_dev_close(&sbi);
        return NULL;
    }

    if (erofs_sb_has_fragments(&sbi) && sbi.packed_nid > 0) {
        erofs_packedfile_init(&sbi, false);
    }

    struct erofs_inode vi = { .sbi = &sbi };
    ret = erofs_ilookup(path, &vi);
    if (ret) {
        erofs_dev_close(&sbi);
        return NULL;
    }

    struct erofs_vfile vf;
    ret = erofs_iopen(&vf, &vi);
    if (ret) {
        erofs_dev_close(&sbi);
        return NULL;
    }

    uint8_t *data = malloc(vi.i_size > 0 ? vi.i_size : 1);
    if (!data) {
        erofs_dev_close(&sbi);
        return NULL;
    }

    if (vi.i_size > 0) {
        ret = erofs_pread(&vf, data, vi.i_size, 0);
        if (ret) {
            free(data);
            erofs_dev_close(&sbi);
            return NULL;
        }
    }

    *out_size = (uint32_t)vi.i_size;
    erofs_dev_close(&sbi);
    return data;
}

/**
 * @brief Frees a buffer allocated by erofs_parse_tree() or erofs_read_file_data().
 *
 * @param ptr Pointer to the allocated memory buffer to free.
 */
EMSCRIPTEN_KEEPALIVE
void erofs_free_buf(void *ptr) {
    if (ptr) free(ptr);
}
