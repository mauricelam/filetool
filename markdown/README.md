# Markdown Handler

A handler for markdown files that renders the formatted content.

## Features

- Render markdown files with proper formatting
- Syntax highlighting for code blocks
- Support for GitHub-flavored markdown
- Responsive design
- Table of contents generation
- Image and link handling

## Supported File Types

- **.md** - Markdown files
- **.markdown** - Alternative markdown extension
- **.txt** - Plain text files (rendered as markdown)

## Usage

1. Drag and drop a markdown file into the main application
2. The markdown handler will automatically open for supported files
3. View the rendered markdown content
4. Navigate using the table of contents (if available)
5. Copy formatted content if needed

## Implementation Details

- Built with React and TypeScript
- Uses markdown parsing libraries for rendering
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **markdown-it** - Markdown parser and renderer
- **react-syntax-highlighter** - Code syntax highlighting

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
markdown/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles markdown parsing and rendering

The handler uses markdown-it to parse markdown files and render them as HTML. Code blocks are highlighted using react-syntax-highlighter.

## TODO

- Support for math expressions (KaTeX/MathJax)
- Add export to PDF/HTML

## Markdown Features

- Headers and sections
- Lists (ordered and unordered)
- Code blocks with syntax highlighting
- Tables
- Links and images
- Blockquotes
- Emphasis and strong text
- Task lists
- Strikethrough
