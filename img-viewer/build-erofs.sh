#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EROFS_DIR="${SCRIPT_DIR}/erofs-wasm/erofs-utils"
LZ4_DIR="${SCRIPT_DIR}/erofs-wasm/lz4"
WASM_DIST_DIR="${SCRIPT_DIR}/erofs-wasm/dist"
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

mkdir -p "${LZ4_DIR}"
if [ ! -f "${LZ4_DIR}/liblz4.a" ]; then
    echo "[build-erofs.sh] Fetching and compiling lz4..."
    cd "${LZ4_DIR}"
    curl -sSL -O https://raw.githubusercontent.com/lz4/lz4/dev/lib/lz4.c
    curl -sSL -O https://raw.githubusercontent.com/lz4/lz4/dev/lib/lz4.h
    curl -sSL -O https://raw.githubusercontent.com/lz4/lz4/dev/lib/lz4hc.c
    curl -sSL -O https://raw.githubusercontent.com/lz4/lz4/dev/lib/lz4hc.h
    emcc -O2 -c lz4.c -o lz4.o
    emcc -O2 -c lz4hc.c -o lz4hc.o
    emar rcs liblz4.a lz4.o lz4hc.o
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
    emconfigure ./configure MAX_BLOCK_SIZE=4096 --disable-multithreading --without-uuid \
        liblz4_CFLAGS="-I${LZ4_DIR}" liblz4_LIBS="-L${LZ4_DIR} -llz4" \
        zlib_CFLAGS="-s USE_ZLIB=1" zlib_LIBS="-s USE_ZLIB=1"
fi

if [ ! -f "lib/.libs/liberofs.a" ]; then
    emmake make -C lib
fi

cd "${SCRIPT_DIR}"
mkdir -p "${WASM_DIST_DIR}"
mkdir -p "${DIST_DIR}"

emcc -O2 -I"${EROFS_DIR}/include" -I"${EROFS_DIR}" -I"${LZ4_DIR}" \
    erofs-wasm/erofs_api.c "${EROFS_DIR}/lib/.libs/liberofs.a" "${LZ4_DIR}/liblz4.a" \
    -o erofs-wasm/dist/erofs.js \
    -s USE_ZLIB=1 \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createErofsModule" \
    -s EXPORT_ES6=1 \
    -s ENVIRONMENT=web \
    -s FORCE_FILESYSTEM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "FS", "UTF8ToString", "HEAPU8", "HEAP32"]' \
    -s EXPORTED_FUNCTIONS='["_malloc", "_free", "_erofs_parse_tree", "_erofs_read_file_data", "_erofs_free_buf"]'

cp erofs-wasm/dist/erofs.wasm "${DIST_DIR}/erofs.wasm"
