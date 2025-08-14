# WebAssembly Text Format Viewer

A handler for WebAssembly text format (.wat) files that displays the human-readable representation of WASM modules.

## Features

- Parse and display WebAssembly text format files
- Syntax highlighting for WAT syntax
- Module structure visualization
- Function and export information
- Memory and table definitions
- Import and export details

## Supported File Types

- **.wat** - WebAssembly text format files
- **.wasm** - WebAssembly binary files (converted to text format)

## Usage

1. Drag and drop a .wat file into the main application
2. The WAT viewer will automatically open for supported files
3. View the WebAssembly text format with syntax highlighting
4. Navigate through module sections (imports, functions, exports)
5. Examine function bodies and instructions

## Implementation Details

- Built with React and TypeScript
- Uses wabt (WebAssembly Binary Toolkit) for parsing
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **wabt** - WebAssembly Binary Toolkit for parsing and validation

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
wat_viewer/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
├── worker.ts          # Web Worker for parsing
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file loading and WAT display
- **worker.ts** - Web Worker that handles WAT parsing using wabt

The handler uses wabt to parse WebAssembly text format files and displays them with syntax highlighting. Parsing is done in a Web Worker to avoid blocking the main thread.

## TODO

- Add export to WASM binary format

## WebAssembly Text Format Features

- **Module Structure** - Imports, exports, functions, tables, memory
- **Function Definitions** - Parameter types, local variables, instructions
- **Instructions** - All WebAssembly instructions with proper syntax
- **Types** - Function signatures and value types
- **Memory Operations** - Memory definitions and access patterns
- **Table Operations** - Function table definitions and calls

## Parsing Capabilities

- Syntax validation
- Module structure analysis
- Function signature extraction
- Import/export resolution
- Memory and table definitions
- Instruction flow analysis
