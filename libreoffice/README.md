# LibreOffice WASM Handler

This handler provides high-fidelity viewing and editing of legacy `.xls` and modern `.xlsx` files within `filetool` using LibreOffice WebAssembly (LOWA).

## Security Requirements (COOP/COEP)

Because LibreOffice WASM uses multi-threading (pthreads), the browser requires a "Cross-Origin Isolated" environment. This is achieved by serving the handler and its assets with the following HTTP headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Without these headers, `SharedArrayBuffer` will be unavailable, and the WASM module will fail to initialize.

## Deployment

The handler expects the LibreOffice WASM assets (`soffice.js`, `soffice.wasm`, etc.) to be located in the `/filetool/assets/libreoffice/` directory.

## Integration

The handler communicates with the parent window via `postMessage`. It supports both:
- `OPEN_FILE`: `{ type: 'OPEN_FILE', blob: Blob, fileName: string }`
- `respondFile`: Standard `filetool` protocol for file transmission.

Errors are reported back to the parent window via:
- `{ type: 'ERROR', message: string }`
