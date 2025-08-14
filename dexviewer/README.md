# Android DEX Viewer

A handler for Android DEX files that displays class information and bytecode.

## Features

- Parse Android DEX files
- Display class hierarchy and structure
- View method information and bytecode
- Show field definitions
- Support for APK files (extracts and parses DEX)

## Supported File Types

- **.dex** - Android Dalvik Executable files
- **APK** - Android application packages (extracts and parses DEX)

## Usage

1. Drag and drop a .dex file or APK into the main application
2. The DEX viewer will automatically open for supported files
3. Browse the class structure in the tree view
4. View method information and bytecode
5. Examine field definitions and types

## Implementation Details

- Built with Go and compiled to WebAssembly
- Uses custom Go library for parsing DEX files
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **godexviewer** - Go library compiled to WebAssembly for parsing DEX files

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
dexviewer/
├── build.mjs              # Build configuration
├── index.html             # Entry point
├── main.tsx               # Main React component
├── package.json           # Dependencies and scripts
├── godexviewer/           # Go library
│   ├── main.go            # Main Go code
│   ├── go.mod             # Go dependencies
│   └── go.sum             # Go dependency checksums
└── README.md              # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file parsing and DEX structure display
- **godexviewer/** - Go library containing DEX file parsing logic

The handler uses a Go library compiled to WebAssembly to parse Android DEX files. The parsed class structure is displayed in a tree view showing methods, fields, and bytecode information.

## TODO

- Add bytecode instruction visualization
- Implement class hierarchy diagrams
- Add export to readable format
