# Browser Handler

A handler that uses the browser's built-in capabilities to display various file types.

## Features

- Display files using native browser capabilities
- Support for common web formats
- Audio and video playback
- Image viewing and zoom
- PDF document display
- HTML rendering

## Supported File Types

### Media Files
- **Videos** - 3GPP, MP4, WebM, OGV
- **Audio** - M4A, MP3, OGG, WAV, FLAC
- **Images** - JPEG, PNG, WebP, GIF, SVG, ICO, AVIF

### Documents
- **PDF** - Portable Document Format
- **HTML** - HyperText Markup Language
- **SVG** - Scalable Vector Graphics

### Text Files
- **Plain Text** - .txt, .log, .md files
- **Code Files** - Various programming language files
- **Configuration** - JSON, YAML, INI files

## Usage

1. Drag and drop a supported file into the main application
2. The browser handler will automatically open for supported files
3. View the file content using appropriate browser capabilities
4. Use browser controls for media playback
5. Navigate through documents and content

## Implementation Details

- Built with React and TypeScript
- Uses browser-native APIs for file display
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **Browser APIs** - Native file viewing capabilities

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
browser/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles file loading and browser display

The handler uses browser-native APIs to display various file types. Media files are displayed using HTML5 elements, PDFs use browser PDF viewers, and text files are rendered with syntax highlighting.

## Browser Capabilities

- **Media Playback** - Native audio/video controls
- **Image Display** - Zoom, pan, and basic manipulation
- **PDF Rendering** - Document viewing and navigation
- **HTML Rendering** - Web page display
- **Text Display** - Syntax highlighting and formatting

## File Handling

- Format detection and validation
- Appropriate viewer selection
- Error handling for unsupported formats
- Performance optimization
- Memory management for large files
