# Hex Viewer

A binary file viewer that displays files in hexadecimal format with ASCII representation.

## Features

- Hexadecimal and ASCII display of binary files
- Support for all file types
- Scrollable view for large files
- File size and offset information
- Responsive design

## Supported File Types

- All binary files
- Text files (showing both hex and text representations)
- Executables, archives, images, etc.

## Usage

1. Drag and drop any file into the main application
2. The hex viewer will automatically open for binary files
3. Navigate through the file using scroll or keyboard navigation
4. View both hexadecimal and ASCII representations simultaneously

## Implementation Details

- Built with React and TypeScript
- Uses the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

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
hex_viewer/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── hex.tsx            # Hex display component
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - Main component that handles file reception and state management
- **hex.tsx** - Hex display component that renders the binary data in hex/ASCII format

The handler receives files through the postMessage API and renders them in a scrollable hex view with offset information and ASCII representation.

## TODO

- Implement search functionality for hex patterns
- Add export capabilities for hex data
- Add bookmarking for specific offsets
