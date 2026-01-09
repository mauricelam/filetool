# ImageMagick Handler

A handler for image files that processes and displays various image formats.

## Features

- View and process multiple image formats
- Image metadata display (including EXIF tags)
- Basic image transformations
- Support for vector graphics
- Font file preview
- Animated image support (APNG, GIF)
- Android Motion Photo metadata detection (XMP parsing for video offset)

## Supported File Types

### Raster Images
- **JPEG** - Joint Photographic Experts Group
- **PNG** - Portable Network Graphics
- **WebP** - Google's WebP format
- **GIF** - Graphics Interchange Format
- **JXL** - JPEG XL format
- **ICO** - Windows icon files
- **PNM** - Portable anymap format
- **TIFF** - Tagged Image File Format
- **PSD** - Adobe Photoshop files
- **HEIF** - High Efficiency Image Format
- **AVIF** - AV1 Image File Format
- **RAW** - Camera raw formats

### Vector Graphics
- **SVG** - Scalable Vector Graphics

### Animated Images
- **APNG** - Animated Portable Network Graphics
- **GIF** - Animated GIF support

### Fonts
- **TTF/OTF** - TrueType and OpenType fonts
- **WOFF/WOFF2** - Web Open Font Format

## Usage

1. Drag and drop an image file into the main application
2. The ImageMagick handler will automatically open for supported files
3. View the image with zoom and pan controls
4. Access image metadata and properties
5. Apply basic transformations if needed

## Implementation Details

- Uses ImageMagick compiled to WebAssembly for image processing
- Processes images entirely in the browser
- No external dependencies or network requests

## Dependencies

- **ImageMagick** - WebAssembly-compiled image processing library

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
imagemagick/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── motion-photo.ts    # Android Motion Photo metadata extraction logic
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles image loading and display

The handler uses ImageMagick compiled to WebAssembly to process and display various image formats. Images are rendered in a viewport with zoom and pan capabilities.

## TODO

- Add image editing capabilities (crop, resize, filters)
- Implement batch processing for multiple images
- Add support for more RAW camera formats
- Support for image metadata editing
- Add export to different formats
- Allow excecuting arbitrary imagemagick command
