# Text Viewer

A handler for text files that displays content with syntax highlighting and search capabilities.

## Features

- Display text files with syntax highlighting
- Support for multiple programming languages
- Search and replace functionality
- Line numbers and word wrap
- File encoding detection
- Large file handling with virtualization

## Supported File Types

- **Text files** - Plain text (.txt)
- **Source code** - Various programming languages
- **Configuration files** - JSON, YAML, INI, etc.
- **Log files** - Application and system logs
- **Data files** - CSV, TSV, and other delimited formats

## Usage

1. Drag and drop a text file into the main application
2. The text viewer will automatically open for supported files
3. View the file content with syntax highlighting
4. Use search functionality to find specific text
5. Navigate through large files efficiently

## Implementation Details

- Built with React and TypeScript
- Uses syntax highlighting libraries for code formatting
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **react-syntax-highlighter** - Syntax highlighting for code
- **prismjs** - Lightweight syntax highlighting library

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
textviewer/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file loading and text display

The handler uses react-syntax-highlighter and prismjs to provide syntax highlighting for various programming languages. Text content is displayed with line numbers and search capabilities.

## TODO

- Add support for more programming languages
- Implement code folding for large files

## Supported Languages

- JavaScript/TypeScript
- Python
- Java
- C/C++
- Go
- Rust
- HTML/CSS
- SQL
- Shell scripts
- And many more...

## Features

- **Syntax Highlighting** - Automatic language detection and coloring
- **Search & Replace** - Find text with regex support
- **Line Numbers** - Easy navigation and reference
- **Word Wrap** - Configurable text wrapping
- **Large File Support** - Efficient handling of multi-megabyte files
- **Encoding Detection** - Automatic character encoding detection
