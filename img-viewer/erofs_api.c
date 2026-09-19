/**
 * @file erofs_api.c
 * @brief WebAssembly API bridge for EROFS filesystem reader.
 *
 * This file provides a simplified C API wrapping liberofs (from erofs-utils).
 * It is compiled with Emscripten into WebAssembly and exposed to TypeScript/JavaScript
 * for traversing directory structures and reading file contents from EROFS images.
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <emscripten.h>
#include "erofs/inode.h"
#include "erofs/dir.h"
#include "erofs/print.h"

/**
 * @struct strbuf_t
 * @brief Dynamic string buffer for JSON string construction.
 */
typedef struct {
    char *buf;   /**< Pointer to heap-allocated string buffer */
    size_t len;  /**< Current length of string in bytes */
    size_t cap;  /**< Allocated capacity of buffer in bytes */
} strbuf_t;

/**
 * @brief Initializes a dynamic string buffer with default capacity.
 * @param sb Pointer to the string buffer to initialize.
 */
static void strbuf_init(strbuf_t *sb) {
    sb->cap = 1024;
    sb->len = 0;
    sb->buf = malloc(sb->cap);
    if (sb->buf) sb->buf[0] = '\0';
}

/**
 * @brief Appends a string to the dynamic buffer, reallocating if needed.
 * @param sb Pointer to string buffer.
 * @param str Null-terminated string to append.
 */
static void strbuf_append(strbuf_t *sb, const char *str) {
    if (!str) return;
    size_t l = strlen(str);
    if (sb->len + l + 1 > sb->cap) {
        sb->cap = (sb->len + l + 1) * 2;
        sb->buf = realloc(sb->buf, sb->cap);
    }
    memcpy(sb->buf + sb->len, str, l);
    sb->len += l;
    sb->buf[sb->len] = '\0';
}

/**
 * @brief Appends a JSON-escaped string enclosed in quotes.
 * @param sb Pointer to string buffer.
 * @param str Raw string to escape and append.
 */
static void strbuf_append_escaped(strbuf_t *sb, const char *str) {
    strbuf_append(sb, "\"");
    for (const char *p = str; *p; p++) {
        if (*p == '"') strbuf_append(sb, "\\\"");
        else if (*p == '\\') strbuf_append(sb, "\\\\");
        else if (*p == '\n') strbuf_append(sb, "\\n");
        else if (*p == '\r') strbuf_append(sb, "\\r");
        else if (*p == '\t') strbuf_append(sb, "\\t");
        else {
            char c[2] = {*p, '\0'};
            strbuf_append(sb, c);
        }
    }
    strbuf_append(sb, "\"");
}

/**
 * @struct custom_dir_context
 * @brief Wrapper around erofs_dir_context to pass tree traversal state to callbacks.
 */
struct custom_dir_context {
    struct erofs_dir_context ctx; /**< Embedded liberofs directory context */
    strbuf_t *sb;                  /**< Target JSON string buffer */
    char path[PATH_MAX];           /**< Current parent path string */
    bool first;                    /**< Flag indicating if this is the first entry in directory */
};

static int build_tree_node(struct erofs_sb_info *sbi, struct erofs_inode *vi, const char *curr_path, strbuf_t *sb);

/**
 * @brief Callback function invoked by erofs_iterate_dir for each directory entry.
 * @param ctx Pointer to the embedded erofs_dir_context inside custom_dir_context.
 * @return 0 on success, or non-zero error code.
 */
static int build_tree_cb(struct erofs_dir_context *ctx) {
    if (ctx->dot_dotdot) return 0;

    struct custom_dir_context *cctx = (struct custom_dir_context *)ctx;

    char dname[EROFS_NAME_LEN + 1];
    strncpy(dname, ctx->dname, ctx->de_namelen);
    dname[ctx->de_namelen] = '\0';

    if (!cctx->first) {
        strbuf_append(cctx->sb, ",");
    }
    cctx->first = false;

    strbuf_append_escaped(cctx->sb, dname);
    strbuf_append(cctx->sb, ":");

    struct erofs_inode vi = { .sbi = ctx->dir->sbi, .nid = ctx->de_nid };
    int err = erofs_read_inode_from_disk(&vi);
    if (err) return err;

    char next_path[PATH_MAX];
    if (strcmp(cctx->path, "/") == 0) {
        snprintf(next_path, sizeof(next_path), "/%s", dname);
    } else {
        snprintf(next_path, sizeof(next_path), "%s/%s", cctx->path, dname);
    }

    return build_tree_node(ctx->dir->sbi, &vi, next_path, cctx->sb);
}

/**
 * @brief Recursively builds a JSON object representation for a directory or file inode.
 *
 * For directories, it constructs an object with entry names as keys.
 * For regular files, it constructs an object with metadata fields (_size, _mode, _uid, _gid, _path).
 *
 * @param sbi Pointer to super block info.
 * @param vi Pointer to the inode.
 * @param curr_path Absolute path string within EROFS.
 * @param sb Dynamic string buffer for JSON output.
 * @return 0 on success, or error code.
 */
static int build_tree_node(struct erofs_sb_info *sbi, struct erofs_inode *vi, const char *curr_path, strbuf_t *sb) {
    if (S_ISDIR(vi->i_mode)) {
        strbuf_append(sb, "{");

        struct custom_dir_context cctx;
        memset(&cctx, 0, sizeof(cctx));
        cctx.ctx.flags = EROFS_READDIR_VALID_PNID;
        cctx.ctx.pnid = vi->nid;
        cctx.ctx.dir = vi;
        cctx.ctx.cb = build_tree_cb;
        cctx.sb = sb;
        strncpy(cctx.path, curr_path, sizeof(cctx.path) - 1);
        cctx.path[sizeof(cctx.path) - 1] = '\0';
        cctx.first = true;

        int err = erofs_iterate_dir(&cctx.ctx, false);
        if (err) return err;

        strbuf_append(sb, "}");
    } else {
        char meta[256];
        snprintf(meta, sizeof(meta), "{\"_size\":%llu,\"_mode\":%u,\"_uid\":%u,\"_gid\":%u,\"_path\":",
                 (unsigned long long)vi->i_size, vi->i_mode, vi->i_uid, vi->i_gid);
        strbuf_append(sb, meta);
        strbuf_append_escaped(sb, curr_path);
        strbuf_append(sb, "}");
    }
    return 0;
}

/**
 * @brief WASM Export: Parses an EROFS image file and returns its directory hierarchy as JSON.
 *
 * @param img_path Path to image file in WebAssembly virtual filesystem (MEMFS).
 * @return Pointer to heap-allocated JSON string, or NULL on error. Caller must free with api_free_buf.
 */
EMSCRIPTEN_KEEPALIVE
char* api_parse_erofs(const char *img_path) {
    erofs_init_configure();
    struct erofs_sb_info sbi = {0};

    int err = erofs_dev_open(&sbi, img_path, O_RDONLY);
    if (err) {
        erofs_exit_configure();
        return NULL;
    }

    err = erofs_read_superblock(&sbi);
    if (err) {
        erofs_dev_close(&sbi);
        erofs_blob_closeall(&sbi);
        erofs_exit_configure();
        return NULL;
    }

    struct erofs_inode root = { .sbi = &sbi, .nid = sbi.root_nid };
    err = erofs_read_inode_from_disk(&root);
    if (err) {
        erofs_put_super(&sbi);
        erofs_dev_close(&sbi);
        erofs_blob_closeall(&sbi);
        erofs_exit_configure();
        return NULL;
    }

    strbuf_t sb;
    strbuf_init(&sb);

    err = build_tree_node(&sbi, &root, "/", &sb);

    erofs_put_super(&sbi);
    erofs_dev_close(&sbi);
    erofs_blob_closeall(&sbi);
    erofs_exit_configure();

    if (err) {
        free(sb.buf);
        return NULL;
    }

    return sb.buf;
}

/**
 * @brief WASM Export: Reads the full content of a file from an EROFS image.
 *
 * @param img_path Path to image file in WebAssembly virtual filesystem (MEMFS).
 * @param file_path Absolute path of file within EROFS image (e.g. "/hello.txt").
 * @param out_size Output pointer where total file byte count is written.
 * @return Pointer to heap-allocated buffer containing file bytes, or NULL on error. Caller must free with api_free_buf.
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* api_read_file(const char *img_path, const char *file_path, uint32_t *out_size) {
    if (!out_size) return NULL;
    *out_size = 0;

    erofs_init_configure();
    struct erofs_sb_info sbi = {0};

    int err = erofs_dev_open(&sbi, img_path, O_RDONLY);
    if (err) {
        erofs_exit_configure();
        return NULL;
    }

    err = erofs_read_superblock(&sbi);
    if (err) {
        erofs_dev_close(&sbi);
        erofs_blob_closeall(&sbi);
        erofs_exit_configure();
        return NULL;
    }

    struct erofs_inode inode = { .sbi = &sbi };
    err = erofs_ilookup(file_path, &inode);
    if (err) {
        erofs_put_super(&sbi);
        erofs_dev_close(&sbi);
        erofs_blob_closeall(&sbi);
        erofs_exit_configure();
        return NULL;
    }

    struct erofs_vfile vf;
    err = erofs_iopen(&vf, &inode);
    if (err) {
        erofs_put_super(&sbi);
        erofs_dev_close(&sbi);
        erofs_blob_closeall(&sbi);
        erofs_exit_configure();
        return NULL;
    }

    size_t size = inode.i_size;
    uint8_t *buf = malloc(size ? size : 1);
    if (!buf) {
        erofs_put_super(&sbi);
        erofs_dev_close(&sbi);
        erofs_blob_closeall(&sbi);
        erofs_exit_configure();
        return NULL;
    }

    err = erofs_pread(&vf, buf, size, 0);

    erofs_put_super(&sbi);
    erofs_dev_close(&sbi);
    erofs_blob_closeall(&sbi);
    erofs_exit_configure();

    if (err) {
        free(buf);
        return NULL;
    }

    *out_size = (uint32_t)size;
    return buf;
}

/**
 * @brief WASM Export: Frees memory allocated by api_parse_erofs or api_read_file.
 * @param ptr Pointer to memory block to free.
 */
EMSCRIPTEN_KEEPALIVE
void api_free_buf(void *ptr) {
    if (ptr) free(ptr);
}
