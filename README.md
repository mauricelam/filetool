## File tool

Vibe coded WASM file inspection tool in the browser: https://mauricelam.github.io/filetool/

The idea is that you drag a file into the tool, using the browser sandbox, be able to inspect the contents of the file.

## Cross-iframe Communication

The application uses postMessage for communication between the main window and tool iframes. Here's the message format specification:

### Tool to Main Window Messages

1. Request File
```javascript
{
    action: 'requestFile'
}
```
Sent by a tool when it is loaded and ready to process a file. The main window will respond with a `respondFile` message.

2. Open File
```javascript
{
    action: 'openFile',
    file: File  // The file to open in a new tool
}
```
Sent by a tool when it wants to open a new file in another tool (e.g., when extracting a file from an archive).

### Main Window to Tool Messages

1. Respond File
```javascript
{
    action: 'respondFile',
    file: File,  // The file to process
    originalType: string,  // Optional: The original MIME type of the file
    additionalFiles: File[] // Optional: Additional associated files (e.g. multi-DEX)
}
```
Sent by the main window in response to a `requestFile` message. Contains the file to be processed by the tool.

### Implementation Details

1. Each tool should initialize by sending a `requestFile` message if it's in an iframe:
```javascript
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' })
}
```

2. Each tool should listen for the `respondFile` message:
```javascript
window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}
```


## Development and Building

This project is a monorepo managed with [Turborepo](https://turbo.build/).

### Setup

```sh
# Install dependencies
npm install
```

### Development

To start the development server with live-reloading for all workspaces:

```sh
npm run serve
```

This runs `turbo watch` in parallel with the main development server.

### Building

To build all workspaces in parallel:

```sh
npm run build
```

The build artifacts are generally placed in the root `dist/` directory.

#### Building specific handlers

To build a single handler (workspace), use the `--filter` flag:

```sh
npx turbo build --filter=archive-viewer
```

Replace `archive-viewer` with the package name of the workspace (found in its `package.json`).

## Testing

This project contains both unit tests and integration tests, orchestrated by Turborepo.

### Unit Tests

You can run unit tests for all workspaces:

```sh
npm run test
```

To run tests for a specific workspace:

```sh
npx turbo test --filter=proguardviewer
```

- **Rust/WASM Unit Tests**: For workspaces with Rust-based WebAssembly modules (e.g., `proguardviewer/proguard-wasm`), navigate to the module's directory and run `cargo test`.

- **Frontend Unit Tests**: React components use `vitest` or `jest`.

### Integration tests & Network Privacy Enforcement

This repository includes Playwright-based integration tests under `tests/integration/` and individual workspace `tests/` directories.

All Playwright tests use a shared fixture (`tests/fixtures.ts`) to enforce network privacy:

- **Cross-Origin Request Blocking**: Intercepts network requests using `context.route('**/*')`. Same-origin requests (`http://localhost:8080`, `blob:`, `data:`) are allowed, while cross-origin requests are blocked/aborted and fail the test.
- **HTTP Method Enforcement**: Non-`GET`/`HEAD` requests (such as `POST`, `PUT`, or `DELETE`) automatically fail the test.
- **Canary Data Leak Check**: Verifies that no request URL or postData body contains the file name or25 distinctive content of any file opened during the test.
- **Offline File Processing**: Calls `context.setOffline(true)` after viewer initialization and before sending files to ensure that processing operates completely offline without network dependencies.

#### How to run

From the project root:

```sh
npm run test:integration
```

This command will build the project, prepare the test harness, and run the Playwright tests.

### Known violations

Audit date: October 2026.

The following known network violations are tracked with `test.fail()` markers:

1. **Android Binary XML Handler**
   - **Code path**: Opening decompiled binary XML in an inner `textviewer` iframe.
   - **Behavior**: When decompiling binary XML, `android-xml` creates a nested `iframe` to display the extracted text XML in `textviewer`. The inner iframe's HTML and JS bundle (`/filetool/textviewer/index.html`) are fetched over the network on demand after file opening, which fails when the browser context is offline.
   - **Catching Test**: `android-xml/tests/binaryxml.spec.ts` (`should correctly process and display a standalone binary XML file in android-xml` and `should correctly process and display a binary XML file with multiple roots`)
   - **Severity**: **needs network**
   - **Follow-up issue**: TBD (pre-cache or bundle nested iframe assets so handler switching works offline)

2. **Decompressor Handler**
   - **Code path**: Displaying decompressed payload in a nested target handler iframe.
   - **Behavior**: When decompressing files (GZIP, BZIP2, XZ, LZMA, Brotli, ZLIB, LZFSE), `decompressor` creates a nested `iframe` for the target viewer (e.g., `textviewer`). The nested iframe assets are fetched over the network on demand after file opening, failing in offline mode.
   - **Catching Test**: `decompressor/tests/decompressor.spec.ts` (`should decompress a <FORMAT> file and display the content`)
   - **Severity**: **needs network**
   - **Follow-up issue**: TBD (pre-cache or bundle nested iframe assets so handler switching works offline)

