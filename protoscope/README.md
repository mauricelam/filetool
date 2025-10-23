# Protoscope Handler

A handler for Protocol Buffer files that displays the human-readable representation of protobuf binary files.

## Features

- Parse and display Protocol Buffer binary files
- Support for .proto schema files
- Binary data visualization
- Field type and value information
- Message structure exploration
- Schema validation

## Supported File Types

- **.pb** - Protocol Buffer binary files

## Usage

1. Drag and drop a protobuf file into the main application
2. The protoscope handler will automatically open for supported files
3. View the protobuf message structure
4. Explore field values and types
5. Validate against schema if available

## Implementation Details

- Built with Go and compiled to WebAssembly
- Uses custom Go library for protobuf parsing
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

### Schema parsing notes

- When a `.proto` schema is supplied, we parse it with `protobuf.js` and generate a `FileDescriptorSet` for the WASM backend.
- To robustly support forward references and recursive type graphs in user-provided schemas, the app now calls `root.resolveAll()` on the parsed `Root` before generating the descriptor. This prevents "illegal type" errors (e.g., when a message references another message defined later in the file) without requiring any modification to the original `.proto` file.

#### Map entry normalization (`normalizeMapEntryNames`)

Go's `protodesc` enforces a specific convention for implicit map entry types:

- For a map field named `foo` on a message `Parent`, there must be a nested message named `FooEntry` inside `Parent` with `options.map_entry = true`.
- The map field's descriptor (`FieldDescriptorProto`) must reference that nested entry by a fully-qualified `type_name` (e.g., `.package.Parent.FooEntry`).

`protobuf.js` may emit a different name for the implicit entry (e.g., `Foo`) or leave `typeName` unqualified, which causes `protodesc` to reject the descriptor with errors like:

```
proto: message field "X.Y.Parent.foo" is an invalid map: incorrect implicit map entry name
```

To avoid requiring any changes to the original `.proto` file, we normalize the descriptor object prior to encoding and passing it to Go:

- Rename any implicit map entry nested type to `<FieldName>Entry`.
- Set the map field's `type_name`/`typeName` to the fully-qualified nested entry name (e.g., `.package.Parent.FooEntry`).
- Fully-qualify other message references where possible to reduce ambiguity.

Implementation: see `protoscope/normalizeMapEntryNames.tsx`. This module mutates the in-memory `FileDescriptorSet` produced by `protobuf.js` to match Go's expectations.

## Dependencies

- **Go protobuf libraries** - Protocol Buffer parsing and validation

## Development

```bash
# Install Go dependencies
go mod tidy

# Build the handler
npm run build

# Watch for changes
npm run watch
```

## Testing

This package uses Vitest for unit tests.

```bash
# Install dev dependencies (first time only)
npm install

# Run tests
npm test
```

If you see module resolution errors (e.g., missing `acorn`), ensure dev dependencies are installed in this sub-package directory (`protoscope/`). You can also explicitly install Vitest and related deps:

```bash
npm i -D vitest
```

## File Structure

```
protoscope/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
├── main.go            # Go protobuf parsing code
├── go.mod             # Go dependencies
├── go.sum             # Go dependency checksums
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file loading and protobuf display
- **main.go** - Go code that parses Protocol Buffer files

The handler uses Go libraries compiled to WebAssembly to parse Protocol Buffer files. The parsed message structure is displayed in a tree view showing fields, types, and values.

## TODO

- Support conversion to/from textproto

## Parsing Capabilities

- Binary format detection
- Message structure analysis
- Field type inference
- Schema validation
- Error reporting
- Performance optimization for large files
