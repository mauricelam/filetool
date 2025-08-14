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

```bash
npm test
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
