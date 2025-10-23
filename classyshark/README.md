# ClassyShark Handler

A handler for Android APK files that provides analysis of package structure and contents.

## Features

- Analyze Android APK files
- Display package information and permissions
- Show activity and service components
- View manifest contents
- Analyze dependencies and libraries
- Support for large APK files

## Supported File Types

- **.apk** - Android application packages
- **.aab** - Android App Bundle files

## Usage

1. Drag and drop an APK file into the main application
2. The ClassyShark handler will automatically open for supported files
3. View package information and manifest
4. Examine permissions and components
5. Analyze dependencies and library usage

## Implementation Details

- Built with Java and compiled to WebAssembly
- Uses ClassyShark library for APK analysis
- Implements the standard `requestFile`/`respondFile` messaging protocol
- Processes files entirely in the browser
- No external dependencies or network requests

## Dependencies

- **ClassyShark** - Java APK analysis library
- **CheerpJ** - Java to JavaScript compiler

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
classyshark/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
├── ClassyShark.jar    # Java library
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles APK loading and analysis display
- **ClassyShark.jar** - Java library for APK parsing and analysis

The handler uses ClassyShark compiled with CheerpJ to analyze Android APK files. The analysis results are displayed in a structured format showing package information, permissions, and components.

## APK Analysis Features

- **Package Information** - App name, version, package ID
- **Manifest Analysis** - AndroidManifest.xml contents
- **Permissions** - Required and optional permissions
- **Components** - Activities, services, receivers
- **Dependencies** - External libraries and frameworks
- **File Structure** - APK contents and organization

## Analysis Capabilities

- APK format validation
- Manifest parsing and display
- Permission analysis
- Component inspection
- Dependency resolution
- Performance optimization
- Error handling and reporting

## Use Cases

- **Security Analysis** - Permission and component review
- **Development** - APK structure understanding
- **Reverse Engineering** - App behavior analysis
- **Compliance** - Permission and component auditing
