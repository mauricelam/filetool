OUTDIR="./dist"
mkdir -p "$OUTDIR"
emcc lzfse/src/lzfse_decode.c lzfse/src/lzfse_decode_base.c lzfse/src/lzvn_decode_base.c lzfse/src/lzfse_fse.c \
    -I lzfse/src -o "$OUTDIR/lzfse.js" \
    -s FORCE_FILESYSTEM=1 \
    -s ENVIRONMENT=web \
    -s EXPORTED_FUNCTIONS='["_lzfse_decode_buffer", "_malloc", "_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU8", "cwrap"]' \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createLzfseModule' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s WASM=1 \
    --emit-tsd lzfse.d.ts