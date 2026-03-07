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
    originalType: string  // Optional: The original MIME type of the file
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

## Supported Handlers and File Types

| Handler | Supported File Types |
|---------|---------------------|
| Hex | All files |
| EML/MHTML | EML files |
| Browser | Videos (3GPP, MP4), Audio (M4A, MP3), HTML, PDF, Images (JPEG, PNG, WebP, GIF, SVG, ICO) |
| DEX Viewers (Go/Rust) | Android DEX files |
| Text | Text files, EML, SVG, JSON, JavaScript |
| JQ | JSON files |
| 3D Model | STL, OBJ, GLB, GLTF, FBX, PLY |
| WebAssembly | WASM files |
| Archive | ZIP, GZIP, XZ, APK, RAR, 7Z, JAR, LZH |
| Android APK | APK files |
| JVM Classfile | Java class files |
| Binutils | Mach-O, Executables, Shared Libraries |
| SVG Viewer | SVG files (interactive pan/zoom, PNG export) |
| ImageMagick | JPEG, PNG, WebP, GIF, JXL, ICO, PNM, TIFF, PSD, HEIF, Fonts, APNG, AVIF, RAW |
| FFmpeg | 3GPP, AAC, MPEG, F4V, FLAC, FLV, HLS, MP4, MKV, WebM, MP3, Ogg, SWF, WAV, AVI, QuickTime |
| Markdown | MD files |
| Protoscope | Protocol Buffer files |
| X.509 Certificates | .der, .crt, .cer, .pem |

## Modal dialogs

When implementing modal dialogs in this repository, follow these UX and accessibility guidelines so behavior is consistent across tools and components:

- Close affordances:
    - Provide a visible close icon (for example, an 'X' SVG) in the top-right of the dialog. The icon button should include an accessible name (e.g. `aria-label="Close"`).
    - Support closing the modal by clicking the backdrop (clicking outside the dialog content).
    - Support closing the modal with the Escape (Esc) key.

- Accessibility and focus:
    - Use `role="dialog"` and `aria-modal="true"` on the modal container.
    - Return focus to the element that opened the dialog when it closes.
    - Ensure the close button is keyboard-focusable and visible when focused.

- Component API recommendation:
    - Modal components should accept an `onClose: () => void` prop and call it for any close action (icon click, backdrop click, Esc key). This keeps the open/close state controlled by the parent.

Following these rules makes dialogs predictable and keyboard-friendly for all users. See `jqviewer/cheatsheet.tsx` and `jqviewer/main.tsx` for an example implementation in this project.


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

This repository includes Playwright-based integration tests under `tests/integration/`. The tests use a small test harness page that loads a handler iframe and posts a file to it.

#### How to run

From the project root:

```sh
npm run test:integration
```

This command will build the project, prepare the test harness, and run the Playwright tests.


