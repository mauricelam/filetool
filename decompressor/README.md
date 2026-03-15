# Decompressor Handler

This handler decompresses files compressed with various algorithms including LZFSE, GZIP, ZLIB, LZMA, XZ, and Brotli. It uses a WebAssembly module written in Rust.

## Implementation

The handler consists of a React-based UI (`main.tsx`) and a web worker (`worker.ts`). The UI is responsible for receiving the file from the main application and displaying the decompressed content. The actual decompression is performed in the web worker to avoid blocking the main thread.

The web worker loads and instantiates the WebAssembly module (`decompressor_wasm_bg.wasm`) and its JavaScript bindings (`decompressor_wasm.js`). When it receives a file from the main thread, it reads the file's content and calls the `decode` function to decompress the data. The decompressed data is then sent back to the main thread for display.

## Building the WebAssembly Module

To build the WebAssembly module, you need to have `wasm-pack` installed.

Run the following command from the `decompressor/decompressor-wasm` directory:

```bash
npx wasm-pack build --target web
```
