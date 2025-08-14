# Rust DEX Viewer

A handler for Android DEX files that provides parsing and analysis using Rust and WebAssembly.

## Features

- Parse and analyze Android DEX files
- Display class hierarchy and structure
- View method information and bytecode
- Show field definitions and types
- Support for APK files (extracts and parses DEX)
- Rust-based parsing implementation

## Supported File Types

- **.dex** - Android Dalvik Executable files
- **APK** - Android application packages (extracts and parses DEX)

## Usage

1. Drag and drop a .dex file or APK into the main application
2. The Rust DEX viewer will automatically open for supported files
3. Browse the class structure in the tree view
4. View method information and bytecode
5. Examine field definitions and types

## Implementation Details

- Built with Rust and compiled to WebAssembly
- Uses custom Rust library for parsing DEX files
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **dex-parser** - Rust library for parsing DEX files
- **dexviewer** - WebAssembly bindings for the Rust library

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
rustdexviewer/
├── build.mjs              # Build configuration
├── index.html             # Entry point
├── main.tsx               # Main React component
├── package.json           # Dependencies and scripts
├── dex-parser/            # Rust DEX parsing library
│   ├── src/               # Rust source code
│   ├── examples/          # Usage examples
│   ├── tests/             # Test suite
│   └── Cargo.toml         # Rust dependencies
├── dexviewer/             # WebAssembly bindings
│   ├── src/               # Rust binding code
│   ├── pkg/               # Compiled WebAssembly
│   └── Cargo.toml         # Rust dependencies
└── README.md              # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file loading and DEX structure display
- **dex-parser/** - Rust library containing the core DEX parsing logic
- **dexviewer/** - WebAssembly bindings that expose the Rust library to JavaScript

The handler uses a Rust library compiled to WebAssembly to parse Android DEX files. The parsed class structure is displayed in a tree view showing methods, fields, and bytecode information.

## Rust Library Features

The `dex-parser` directory contains the core Rust library for parsing Android DEX files:

- **Class Parsing** - Complete class structure analysis
- **Method Analysis** - Bytecode instruction parsing
- **Field Handling** - Field type and access information
- **Constant Pool** - String and reference resolution
- **Performance** - Optimized for large DEX files
- **Error Handling** - Comprehensive error reporting

## WebAssembly Bindings

The `dexviewer` directory contains the WebAssembly interface:

- **src/lib.rs** - Main binding code for browser integration
- **pkg/** - Compiled WebAssembly output
- **opcodes.rs** - DEX opcode definitions and handling

## Use Cases

- **APK Analysis** - Reverse engineering Android applications
- **Security Research** - Malware analysis and security auditing
- **Development** - Understanding app structure and behavior
- **Education** - Learning Android development and DEX format
