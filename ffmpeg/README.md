# FFmpeg Handler

A handler for multimedia files that supports audio and video playback.

## Features

- Audio and video playback
- Support for multiple multimedia formats
- Media metadata display
- Stream information
- Codec details
- Thumbnail generation

## Supported File Types

### Video Formats
- **3GPP** - 3rd Generation Partnership Project
- **MP4** - MPEG-4 Part 14
- **MKV** - Matroska Video
- **WebM** - Web Media format
- **AVI** - Audio Video Interleave
- **QuickTime** - Apple's multimedia format
- **FLV** - Flash Video
- **F4V** - Flash Video (H.264)
- **SWF** - Shockwave Flash

### Audio Formats
- **AAC** - Advanced Audio Coding
- **MPEG** - MPEG audio formats
- **MP3** - MPEG-1 Audio Layer III
- **FLAC** - Free Lossless Audio Codec
- **Ogg** - Ogg container format
- **WAV** - Waveform Audio File Format

### Streaming
- **HLS** - HTTP Live Streaming

## Usage

1. Drag and drop an audio or video file into the main application
2. The FFmpeg handler will automatically open for supported files
3. View media metadata and stream information
4. Play audio/video content
5. Access codec and format details

## Implementation Details

- Built with React and TypeScript
- Uses FFmpeg compiled to WebAssembly for media processing
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes media files entirely in the browser
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
ffmpeg/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## TODO

- Allow arbitrary ffmpeg command

## Media Processing Capabilities

- Format detection and validation
- Stream extraction and analysis
- Metadata extraction
- Thumbnail generation
- Audio/video playback
- Codec information display
