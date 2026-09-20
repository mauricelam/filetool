#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EROFS_DIR="${SCRIPT_DIR}/erofs-wasm/erofs-utils"
DIST_DIR="${SCRIPT_DIR}/../dist/img-viewer"

if ! command -v emcc &> /dev/null; then
    if [ -f "/tmp/emsdk/emsdk_env.sh" ]; then
        source "/tmp/emsdk/emsdk_env.sh" >/dev/null 2>&1 || true
    else
        echo "[build-erofs.sh] Installing emsdk into /tmp/emsdk..."
        git clone https://github.com/emscripten-core/emsdk.git /tmp/emsdk
        /tmp/emsdk/emsdk install 3.1.61
        /tmp/emsdk/emsdk activate 3.1.61
        source /tmp/emsdk/emsdk_env.sh
    fi
fi

if [ ! -d "${EROFS_DIR}" ]; then
    echo "[build-erofs.sh] Cloning erofs-utils..."
    git clone --depth 1 https://github.com/erofs/erofs-utils.git "${EROFS_DIR}"
fi

cd "${EROFS_DIR}"
if [ ! -f "configure" ]; then
    ./autogen.sh
fi

if [ ! -f "Makefile" ]; then
    emconfigure ./configure MAX_BLOCK_SIZE=4096 --disable-multithreading --without-zlib --disable-lz4 --disable-lzma --without-uuid
fi

if [ ! -f "lib/.libs/liberofs.a" ]; then
    emmake make -C lib
fi

cd "${SCRIPT_DIR}"
mkdir -p erofs-wasm
mkdir -p "${DIST_DIR}"

emcc -O2 -I"${EROFS_DIR}/include" -I"${EROFS_DIR}" \
    erofs-wasm/erofs_api.c "${EROFS_DIR}/lib/.libs/liberofs.a" \
    -o erofs-wasm/erofs.js \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createErofsModule" \
    -s EXPORT_ES6=1 \
    -s ENVIRONMENT=web \
    -s FORCE_FILESYSTEM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "FS", "UTF8ToString", "HEAPU8", "HEAP32"]' \
    -s EXPORTED_FUNCTIONS='["_malloc", "_free", "_erofs_parse_tree", "_erofs_read_file_data", "_erofs_free_buf"]'

cp erofs-wasm/erofs.wasm "${DIST_DIR}/erofs.wasm"
