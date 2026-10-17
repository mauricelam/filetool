# Binary Property List (bplist) Viewer

A web-based viewer for Apple Binary Property List (`.plist`, `.bplist`) files.

## Features

- **Binary Plist Parsing**: Decodes Apple binary property lists into JavaScript object representations.
- **Interactive Tree View**: Renders parsed structure as an expandable and collapsible tree using `@microlink/react-json-view`.
- **Validation & Warnings**: Detects header/trailer integrity, offset table boundaries, object count thresholds, and truncation issues, displaying clear warning banners.
- **Error Handling**: Gracefully surfaces corrupt or unsupported data formats.
- **Zero-Server Processing**: Operates entirely client-side in the browser.

## Supported File Types

- **Binary Plist (`.plist`, `.bplist`)**: Apple binary property list files beginning with `bplist00` (or similar `bplist` magic signatures).

## Usage

1. Open or drop a binary property list file in the file viewer application.
2. The viewer automatically receives the file payload via `postMessage`.
3. Browse, expand, and inspect keys, values, arrays, dictionaries, dates, and UIDs.

## Technical Architecture

- **`parser.ts`**: Pure TypeScript binary property list parser (adapted from `dd-plist`). Reads header (`bplist`), trailer (32-byte descriptor at EOF containing object counts, top object, and offset table offset), offset table, and recursively reconstructs property list structures (primitive types, integers, floats, dates, UID objects, strings, arrays, and dictionaries).
- **`main.tsx`**: React frontend component that listens for `respondFile` messages, initiates parsing, renders tree structures via `ReactJson`, and handles error/warning states.

## Dependencies

- **`react` & `react-dom`**: Frontend framework and DOM renderer.
- **`@microlink/react-json-view`**: Interactive JSON and object hierarchy tree component.
- **`buffer`**: Node.js `Buffer` polyfill for binary data slicing and big-endian UInt/Float/Double decoding.

## Development

```bash
# Build the component
npm run --workspace=@filetool/bplist build

# Watch mode for local development
npm run --workspace=@filetool/bplist watch
```

## File Structure

```
bplistviewer/
├── build.mjs          # esbuild bundle configuration
├── index.html         # HTML entry point wrapper
├── main.tsx           # React entry point and UI component
├── package.json       # Workspace configuration and dependencies
├── parser.ts          # Binary plist parser and decoder
└── README.md          # Documentation
```
