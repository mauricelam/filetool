# WebGL 3D Model Previewer

A handler for 3D model files that renders them using WebGL technology.

## Features

- Load and display 3D models in multiple formats
- Interactive 3D viewport with camera controls
- Model rotation, zoom, and pan
- Support for textures and materials
- Multiple rendering modes
- Model statistics and information

## Supported File Types

- **STL** - Stereolithography files
- **OBJ** - Wavefront Object files
- **GLB/GLTF** - glTF binary and text formats
- **FBX** - Autodesk FBX files
- **PLY** - Stanford Polygon Library format
- **3DS** - 3D Studio files
- **DAE** - COLLADA files

## Usage

1. Drag and drop a 3D model file into the main application
2. The 3D previewer will automatically open for supported files
3. Use mouse controls to navigate the 3D viewport
4. Rotate, zoom, and pan around the model
5. Switch between different rendering modes

## Implementation Details

- Built with vanilla JavaScript and WebGL
- Uses Three.js for 3D rendering and model loading
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **Three.js** - 3D graphics library
- **WebGL** - Hardware-accelerated 3D graphics

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
webgl_previewer/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.ts            # Main JavaScript component
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Technical Architecture

- **main.ts** - JavaScript component that handles 3D model loading and rendering

The handler uses Three.js and WebGL to load and render 3D model files. Models are displayed in an interactive viewport with camera controls and multiple rendering options.

## TODO

- Add export to different 3D formats

## 3D Rendering Features

- **Camera Controls** - Orbit, pan, and zoom
- **Lighting** - Multiple light sources and shadows
- **Materials** - PBR materials and textures
- **Rendering Modes** - Wireframe, solid, textured
- **Performance** - Optimized rendering for large models
- **Export** - Screenshot and model export capabilities

## Model Processing

- Automatic format detection
- Geometry optimization
- Texture loading and mapping
- Material assignment
- Animation support (where applicable)
- Model statistics and metadata
