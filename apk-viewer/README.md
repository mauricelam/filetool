# Binary XML Handler

A handler for Android binary XML files that parses and displays the structured content.

## Features

- Parse Android binary XML files
- Display XML structure in a readable format
- Support for Android APK resource files
- Tree view of XML elements and attributes
- Namespace handling

## Supported File Types

- **XML** - Android binary XML files
- **ARSC** - Android resource table files
- **APK** - Android application packages (extracts and parses Android XMLs)

## Usage

1. Drag and drop an Android XML file or APK into the main application
2. The binary XML handler will automatically open for supported files
3. Browse the XML structure in the tree view
4. Expand/collapse elements to explore the hierarchy
5. View element attributes and values

## Implementation Details

- Built with Rust and compiled to WebAssembly
- Uses abxml-rs library for parsing binary XML
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Development

```bash
# Install dependencies
npm install

# Build the handler
npm run build

# Watch for changes
npm run watch
```

## Testing

```bash
npm test
```

## File Structure

```
apk-viewer/
├── build.mjs              # Build configuration
├── index.html             # Entry point
├── main.tsx               # Main React component
├── package.json           # Dependencies and scripts
├── abxml-rs/              # Rust library source
├── wasm/                  # WebAssembly bindings
└── README.md              # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file parsing and XML tree display
- **abxml-rs/** - Rust library containing the core XML parsing logic
- **wasm/** - WebAssembly bindings that expose the Rust library to JavaScript

The handler uses a Rust library compiled to WebAssembly to parse Android binary XML files. The parsed XML structure is displayed in a tree view component.

## TODO

- Add support for XML schema validation
- Add export to standard XML format
- Support for XML namespace handling
- Add search and filter functionality
