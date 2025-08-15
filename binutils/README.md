# Binutils Handler

A handler for executable files, shared libraries, and object files that provides binary analysis capabilities.

## Features

- Parse and analyze executable files
- Display symbol tables and sections
- Show disassembly of code sections
- Analyze shared library dependencies
- View file headers and metadata
- Support for multiple architectures

## Supported File Types

- **Executables** - ELF, Mach-O, PE files
- **Shared Libraries** - .so, .dylib, .dll files
- **Object Files** - .o, .obj files
- **Core Dumps** - Memory dumps for analysis

## Usage

1. Drag and drop an executable or library file into the main application
2. The binutils handler will automatically open for supported files
3. View file structure and sections
4. Examine symbol tables and dependencies
5. Analyze disassembly if available

## Implementation Details

- Built with React and TypeScript
- Uses binutils compiled to WebAssembly for binary analysis
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **Binutils** - WebAssembly-compiled binary analysis tools

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
binutils/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
├── worker.ts          # Web Worker for analysis
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file loading and binary analysis display
- **worker.ts** - Web Worker that processes binary files using binutils

The handler uses binutils compiled to WebAssembly to analyze executable files. Binary analysis is performed in a Web Worker to avoid blocking the main thread.

## TODO

- Implement disassembly visualization
- Add symbol search and filtering
- Support for debugging information

## Binary Analysis Features

- **File Headers** - Executable format information
- **Sections** - Code, data, and metadata sections
- **Symbol Tables** - Function and variable symbols
- **Dependencies** - Shared library requirements
- **Disassembly** - Machine code to assembly translation
- **Relocations** - Address fixup information

## Supported Architectures

- **x86/x86-64** - Intel and AMD processors
- **ARM** - ARM processors (32-bit and 64-bit)
- **MIPS** - MIPS processors
- **PowerPC** - PowerPC processors
- **RISC-V** - RISC-V processors

## Analysis Capabilities

- Format detection and validation
- Header parsing and display
- Symbol table analysis
- Dependency resolution
- Performance optimization
- Error handling and reporting
