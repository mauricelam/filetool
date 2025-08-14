# Graphviz Handler

A handler for Graphviz DOT language files that renders them into interactive diagrams.

## Features

- Parse and render Graphviz DOT files
- Interactive graph visualization
- Zoom and pan controls
- Node and edge highlighting
- Multiple layout algorithms
- Export to various formats

## Supported File Types

- **.gv** - Graphviz DOT files
- **.dot** - Alternative DOT extension
- **.txt** - Text files containing DOT content

## Usage

1. Drag and drop a DOT file into the main application
2. The Graphviz handler will automatically open for supported files
3. View the rendered graph visualization
4. Interact with nodes and edges
5. Navigate and explore the graph structure

## Implementation Details

- Built with React and TypeScript
- Uses Graphviz compiled to WebAssembly for rendering
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **Graphviz** - WebAssembly-compiled graph visualization library

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
graphviz/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
├── testdata/          # Sample DOT files
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles DOT parsing and graph rendering
- **testdata/** - Sample DOT files for testing

The handler uses Graphviz compiled to WebAssembly to parse DOT files and render them as interactive SVG diagrams. The rendered graphs support zoom, pan, and node interaction.

## TODO

- Support for graph export as PNG

## Graphviz Features

- **Layout Algorithms** - dot, neato, fdp, sfdp, twopi, circo
- **Node Attributes** - Shape, color, size, label
- **Edge Attributes** - Style, color, weight, label
- **Subgraphs** - Clustered graph support
- **HTML Labels** - Rich text and formatting
- **Custom Shapes** - User-defined node shapes

## Rendering Capabilities

- DOT language parsing
- Layout computation
- SVG generation
- Interactive features
- Performance optimization
- Error handling and reporting

## Sample Files

The `testdata/` directory contains example DOT files for testing:
- **git.gv** - Git workflow diagram
- **twopi2.gv** - Radial layout example
