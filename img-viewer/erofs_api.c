#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <emscripten.h>
#include "erofs/inode.h"
#include "erofs/dir.h"
#include "erofs/print.h"

typedef struct {
    char *buf;
    size_t len;
    size_t cap;
} strbuf_t;

static void strbuf_init(strbuf_t *sb) {
    sb->cap = 1024;
    sb->len = 0;
    sb->buf = malloc(sb->cap);
    if (sb->buf) sb->buf[0] = '\0';
}

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

struct custom_dir_context {
    struct erofs_dir_context ctx;
    strbuf_t *sb;
    char path[PATH_MAX];
    bool first;
};

static int build_tree_node(struct erofs_sb_info *sbi, struct erofs_inode *vi, const char *curr_path, strbuf_t *sb);

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

EMSCRIPTEN_KEEPALIVE
void api_free_buf(void *ptr) {
    if (ptr) free(ptr);
}
