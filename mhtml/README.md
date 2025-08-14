# MHTML Handler

A handler for MHTML (MIME HTML) files that displays web page archives with embedded resources.

## Features

- Parse and display MHTML files
- Extract embedded images and resources
- Show HTML content with styling
- Navigate through multiple pages
- Resource inspection and extraction
- Support for complex web archives

## Supported File Types

- **.mhtml** - MIME HTML files
- **.mht** - Alternative MHTML extension
- **.eml** - Email files (MIME format)

## Usage

1. Drag and drop an MHTML file into the main application
2. The MHTML handler will automatically open for supported files
3. View the HTML content with embedded resources
4. Navigate through multiple pages if present
5. Extract and examine embedded files

## Implementation Details

- Built with React and TypeScript
- Uses custom MIME parsing libraries
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **MIME Parser** - Custom MIME message parsing

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
mhtml/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles MIME parsing and HTML display

The handler parses MIME multipart messages to extract HTML content and embedded resources. The HTML is rendered in an iframe with access to embedded images, CSS, and JavaScript.

## MHTML Features

- **MIME Parsing** - Multipart MIME message handling
- **HTML Rendering** - Web page display with styling
- **Resource Extraction** - Images, CSS, JavaScript files
- **Multi-page Support** - Navigation through archives
- **Content Inspection** - View raw MIME structure

## Processing Capabilities

- MIME boundary detection
- Content type identification
- Resource extraction and display
- HTML rendering and styling
- Performance optimization
- Error handling and reporting

## Use Cases

- **Web Archives** - Complete web page snapshots
- **Email Attachments** - MIME-formatted email content
- **Document Preservation** - Self-contained web documents
- **Offline Viewing** - Web content without internet access
