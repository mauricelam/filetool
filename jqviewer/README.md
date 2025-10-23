# JQ Viewer

A handler for JSON files that allows querying and transformation using jq-like syntax.

## Features

- **Query Editor** - Syntax-highlighted query input
- **Result Display** - Formatted JSON output
- **Error Handling** - Clear error messages for invalid queries
- **Query History** - Save and reuse previous queries
- **Examples** - Built-in query examples for common use cases
- **Performance** - Efficient processing of large JSON files

## Supported File Types

- **.json** - JavaScript Object Notation files
- **.js** - JavaScript files containing JSON data
- **.txt** - Text files containing JSON content

## Usage

1. Drag and drop a JSON file into the main application
2. The JQ viewer will automatically open for supported files
3. View the JSON structure with syntax highlighting
4. Write jq queries to filter and transform the data
5. See results in real-time as you type

## Implementation Details

- Built with React and TypeScript
- Uses jq-wasm for JSON processing and querying
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **jq-wasm** - WebAssembly-compiled jq for JSON processing

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
jqviewer/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
├── jq.worker.ts       # Web Worker for jq processing
├── node-shims.js      # Node.js compatibility shims
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles JSON loading and query interface
- **jq.worker.ts** - Web Worker that processes jq queries using jq-wasm

The handler uses jq-wasm to process JSON files and execute jq queries. Queries are processed in a Web Worker to avoid blocking the main thread.

## JQ Query Examples

- **Basic selection**: `.` (select entire object)
- **Field access**: `.name` (select name field)
- **Array iteration**: `.[]` (iterate over array)
- **Filtering**: `.[] | select(.type == "user")`
- **Transformation**: `.[] | {id: .id, name: .name}`
- **Aggregation**: `.[] | .age | add`