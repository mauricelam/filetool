# reStructuredText Viewer

A handler for reStructuredText (RST) files that renders the formatted content.

## Features

- Parse and render reStructuredText files
- Support for RST syntax and directives
- Table of contents generation
- Code block syntax highlighting
- Cross-reference resolution
- Responsive design

## Supported File Types

- **.rst** - reStructuredText files
- **.txt** - Text files containing RST content
- **.rest** - Alternative RST extension

## Usage

1. Drag and drop an RST file into the main application
2. The RST viewer will automatically open for supported files
3. View the rendered reStructuredText content
4. Navigate using the table of contents
5. Access cross-references and links

## Implementation Details

- Built with React and TypeScript
- Uses custom RST parsing libraries
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **rst2html** - reStructuredText to HTML converter

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
rstviewer/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
├── testdata/          # Test RST files
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles RST parsing and rendering
- **testdata/** - Sample RST files for testing

The handler uses rst2html to convert reStructuredText files to HTML for display. The rendered content includes navigation and cross-reference support.

## TODO

- Add export to HTML

## reStructuredText Features

- **Headers and Sections** - Hierarchical document structure
- **Lists** - Bulleted and numbered lists
- **Code Blocks** - Syntax-highlighted code
- **Tables** - Formatted table display
- **Links and References** - Internal and external links
- **Directives** - RST-specific formatting directives
- **Footnotes** - Footnote support
- **Images** - Image inclusion and display

## Rendering Capabilities

- Syntax parsing and validation
- HTML generation
- CSS styling
- Navigation structure
- Cross-reference resolution
- Error handling and reporting
