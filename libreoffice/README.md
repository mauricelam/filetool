# LibreOffice WASM Handler

This handler provides high-fidelity viewing and editing of legacy `.xls` and modern `.xlsx` files within `filetool` using LibreOffice WebAssembly (LOWA).

## Security Requirements (COOP/COEP)

Because LibreOffice WASM uses multi-threading (pthreads), the browser requires a "Cross-Origin Isolated" environment. This is achieved by serving the handler and its assets with the following HTTP headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Without these headers, `SharedArrayBuffer` will be unavailable, and the WASM module will fail to initialize.

## Deployment

The handler expects the LibreOffice WASM assets (`soffice.js`, `soffice.wasm`, etc.) to be located in the `/filetool/assets/libreoffice/` directory.

### Building LibreOffice WASM

To build the required `soffice.js` and `soffice.wasm` binaries:

1.  **Environment Setup**: Install and activate the latest Emscripten SDK.
2.  **Clone Core**: `git clone https://github.com/LibreOffice/core.git`
3.  **Configure**:
    ```bash
    ./autogen.sh --host=wasm64-local-emscripten --with-distro=LibreOfficeWASM
    ```
4.  **Make**: `make`
5.  **Locate Output**: The binaries will be in `instdir/program/`. Copy `soffice.js`, `soffice.wasm`, and related `.data` or `.worker.js` files to the `/filetool/assets/libreoffice/` directory.

For more details, see the [LibreOffice WASM Wiki](https://wiki.documentfoundation.org/Development/WASM).

## Integration

The handler communicates with the parent window via `postMessage`. It supports the standard `filetool` protocol for file transmission:
- `respondFile`: Received from main window with the file data.
- `requestFile`: Sent to main window to indicate readiness.

Errors are reported back to the parent window via:
- `{ type: 'ERROR', message: string }`
