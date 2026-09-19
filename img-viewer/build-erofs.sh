#!/usr/bin/env bash
set -e

# Add Emscripten SDK to PATH if present in /tmp/emsdk
export PATH="/tmp/emsdk:/tmp/emsdk/upstream/emscripten:$PATH"

cd "$(dirname "$0")/erofs-utils"

# Patch erofs-utils/lib/io.c to avoid buffer overflow on partial pread reads
sed -i 's/pread(vf->fd, buf, len, (off_t)pos)/pread(vf->fd, buf, len - read, (off_t)pos)/g' lib/io.c
sed -i 's/pread64(vf->fd, buf, len, (off64_t)pos)/pread64(vf->fd, buf, len - read, (off64_t)pos)/g' lib/io.c

# Configure erofs-utils with MAX_BLOCK_SIZE=4096 (prevents WASM stack overflow)
# and disable unused optional dependencies to minimize build size.
if [ ! -f Makefile ]; then
    ./autogen.sh
    emconfigure ./configure MAX_BLOCK_SIZE=4096 \
        --disable-multithreading \
        --without-uuid \
        --without-selinux \
        --disable-fuse \
        --disable-ublk \
        --disable-s3 \
        --disable-oci \
        --disable-fanotify
fi

# Build liberofs static library
emmake make -C lib

# Compile C WASM bridge linking liberofs.a
emcc -O2 -Iinclude ../erofs_api.c lib/.libs/liberofs.a \
    -o ../../dist/img-viewer/erofs.js \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createErofsModule" \
    -s EXPORT_ES6=1 \
    -s ENVIRONMENT=web \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s STACK_SIZE=1048576 \
    -s FORCE_FILESYSTEM=1 \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "FS", "UTF8ToString", "HEAPU8", "HEAPU32"]' \
    -s EXPORTED_FUNCTIONS='["_malloc", "_free", "_api_parse_erofs", "_api_read_file", "_api_free_buf"]'
