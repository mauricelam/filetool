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

### Integration tests

This repository includes Playwright-based integration tests across handler workspaces and under `tests/integration/`. The tests use a small test harness page that loads a handler iframe and posts a file to it.

#### Network Isolation Fixture

All Playwright integration tests extend the shared test fixture in `tests/fixtures.ts`:
- **Network Blocking**: Intercepts all browser network requests via `context.route('**/*', ...)`. Same-origin requests (`http://localhost:8080`), `blob:`, and `data:` URLs are allowed; all cross-origin requests are aborted and fail the test.
- **Allowed Methods**: Only `GET` and `HEAD` requests are permitted. Non-GET/HEAD methods fail the test.
- **Canary Checks**: Checks that no recorded request URL or body contains file names or distinctive content strings.
- **Offline Processing**: `runHandlerTest` sets `context.setOffline(true)` before posting file payloads to ensure viewers process files without requiring network connectivity.

#### How to run

From the project root:

```sh
npm run test:integration
```

This command will build the project, prepare the test harness, and run the Playwright tests.

## Known Violations

None found (Audit date: March 2025).
