# LZFSE Handler

This handler decompresses files compressed with the LZFSE algorithm. It uses a WebAssembly module compiled from the original C source code of the [LZFSE library](https://github.com/lzfse/lzfse).

## Implementation

The handler consists of a React-based UI (`main.tsx`) and a web worker (`worker.ts`). The UI is responsible for receiving the file from the main application and displaying the decompressed content. The actual decompression is performed in the web worker to avoid blocking the main thread.

The web worker loads and instantiates the WebAssembly module (`lzfse.wasm`) and its JavaScript bindings (`lzfse.js`). When it receives a file from the main thread, it reads the file's content, allocates memory in the WebAssembly heap, and calls the `lzfse_decode_buffer` function to decompress the data. The decompressed data is then sent back to the main thread for display.

## Building the WebAssembly Module

The WebAssembly module is not checked into the repository. To build it, you need to have the Emscripten SDK installed and activated. The LZFSE source code is included as a git submodule.

To build the WebAssembly module, run the following command from the root of the repository:

```bash
emcc lzfse/lzfse/src/lzfse_decode.c lzfse/lzfse/src/lzfse_decode_base.c lzfse/lzfse/src/lzvn_decode_base.c lzfse/lzfse/src/lzfse_fse.c -I lzfse/lzfse/src -o lzfse/lzfse.js -s FORCE_FILESYSTEM=1 -s ENVIRONMENT=web -s EXPORTED_FUNCTIONS='["_lzfse_decode_buffer", "_malloc", "_free"]' -s EXPORTED_RUNTIME_METHODS='["HEAPU8", "cwrap"]' -s MODULARIZE=1 -s EXPORT_NAME='createLzfseModule' -s ALLOW_MEMORY_GROWTH=1 -s WASM=1
```
