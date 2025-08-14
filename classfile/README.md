# Java Classfile Handler

A handler for Java class files that parses and displays JVM bytecode structure and metadata.

## Features

- Parse Java class files (.class)
- Display class structure and metadata
- View constant pool entries
- Show method and field information
- Display bytecode instructions
- Support for annotations and generics

## Supported File Types

- **.class** - Java compiled class files
- **JAR** - Java archives (extracts and parses .class files)

## Usage

1. Drag and drop a .class file or JAR into the main application
2. The classfile handler will automatically open for supported files
3. Browse the class structure in the tree view
4. View constant pool, methods, fields, and attributes
5. Examine bytecode instructions for methods

## Implementation Details

- Built with Rust and compiled to WebAssembly
- Uses custom Rust library for parsing JVM class files
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **classfile-wasm** - Rust library compiled to WebAssembly for parsing JVM class files

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
classfile/
├── build.mjs              # Build configuration
├── index.html             # Entry point
├── main.tsx               # Main React component
├── package.json           # Dependencies and scripts
├── classfile-wasm/        # WebAssembly library
│   ├── src/               # Rust source code
│   ├── pkg/               # Compiled WebAssembly
│   └── Cargo.toml         # Rust dependencies
└── README.md              # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file parsing and class structure display
- **classfile-wasm/** - Rust library containing JVM class file parsing logic

The handler uses a Rust library compiled to WebAssembly to parse Java class files. The parsed class structure is displayed in a tree view showing methods, fields, and bytecode information.

## TODO

- Add bytecode instruction visualization
- Implement class hierarchy diagrams
- Support for obfuscated class files
