# Archive Handler

A handler for archive files that extracts and displays their contents.

## Features

- Extract and view contents of archive files
- Support for multiple archive formats
- File tree navigation
- Individual file extraction
- Archive metadata display

## Supported File Types

- **ZIP** - Standard ZIP archives
- **RAR** - RAR archives
- **7Z** - 7-Zip archives
- **GZIP** - Gzip compressed files
- **XZ** - XZ compressed files
- **APK** - Android application packages
- **JAR** - Java archives
- **LZH** - LHA/LZH archives
- **TAR** - Tape archive files

## Usage

1. Drag and drop an archive file into the main application
2. The archive handler will automatically open
3. Browse the archive contents in the file tree
4. Click on files to extract and view them
5. Use the "Open in new tool" feature to view extracted files

## Implementation Details

- Built with React and TypeScript
- Uses libarchive.js (WebAssembly) for archive processing
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Supports opening extracted files in other handlers via `openFile` message
- Processes archives entirely in the browser

## Dependencies

- **libarchive.js** - WebAssembly-based archive processing library

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
archive/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
├── libarchive.d.ts    # TypeScript definitions
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - Main component that handles archive parsing and file tree display
- **libarchive.d.ts** - TypeScript definitions for the libarchive.js WebAssembly library

The handler uses libarchive.js to parse archive files and displays their contents in a tree structure. Extracted files can be opened in other handlers through the postMessage API.

## TODO

- Add support for password-protected archives
- Add progress indicators for large archives
