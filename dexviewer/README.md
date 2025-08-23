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

## Smali Linkification (clickable references)

Smali instruction lines rendered in the UI are linkified so you can click method and class references to navigate within the viewer.

- __Implementation file__: `dexviewer/linkify.ts`
- __Entry function__: `linkifySmaliInstruction(instruction, onMethodClick, onClassClick, onFieldClick)`

### What gets linkified
- __Method references__ in plain form, e.g.
  - `processing/core/PShapeSVG:setParent:([Lprocessing/core/PShapeSVG;]):V`
- __Field references__ in plain form, e.g.
  - `processing/core/PShapeSVG:stroke:Z`
- __Class references__ in Dalvik form, e.g.
  - `Ljava/util/ArrayList;`

Regex matchers used:
- __Methods__: `/([\w$][\w\d_$/]*(?:\/[\w$][\w\d_$]*)*):([^:]+):(\([^)]*\))([^\s,;)]*)/g`
- __Fields__: `/([\w$][\w\d_$/]*(?:\/[\w$][\w\d_$]*)*):([\w$][\w\d_$]*):([VZBSCIJFD]|\[+[VZBSCIJFD]|L[^;]+;)/g`
- __Classes__: `/L([\w$][\w\d_$/]*(?:\/[\w$][\w\d_$]*)*);/g`

### How it renders
- Text before/after matches is preserved as text nodes.
- Matches are wrapped as clickable spans via:
  - `createMethodLink(MethodReference, onClick)`
  - `createFieldLink(FieldReference, onFieldClick)`
  - `createClassLink(className, originalText, onClick)`

### Click behavior

- Method links expand the package path, class, and method, then scroll to the method header.
- Class links expand the package path and class, then scroll to the class header.
- Field links expand the package path and class, then scroll directly to the field row when available.

### Field rendering and navigation

Field references are rendered as clickable links. When clicked, the viewer navigates to the declaring class and scrolls to the field row. The `generateFieldId` function creates a unique anchor for each field, allowing for direct navigation.

```javascript
const fieldId = generateFieldId(className, fieldName);
const fieldAnchor = document.getElementById(fieldId);
if (fieldAnchor) {
  fieldAnchor.scrollIntoView();
}
```

### Notes
- The linkifier processes method references first, then class references only for the remaining tail of the line to avoid duplicating leading opcode text.
- Field references are processed after methods and before classes to avoid overlap or duplication.
- Helper IDs: `generateClassId()` and `generateMethodId()` create stable anchors for scrolling.

## Use Cases

- **APK Analysis** - Reverse engineering Android applications
- **Security Research** - Malware analysis and security auditing
- **Development** - Understanding app structure and behavior
- **Education** - Learning Android development and DEX format
