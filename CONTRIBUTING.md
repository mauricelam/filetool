# Contributing to FileMagic

Thank you for your interest in contributing to FileMagic! This project is a browser-based WASM file inspection tool that allows users to inspect various file types directly in the browser.

Note to humans: This file is written by LLMs, and mainly intended as a place for coding agents to write down important instructions I gave it over time, and other instructions when it is setting up a change so they can resume with that context.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Adding New File Handlers](#adding-new-file-handlers)
- [Contributing Guidelines](#contributing-guidelines)
- [Testing](#testing)
- [Building](#building)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)

## Getting Started

## Project Structure

FileMagic is organized as a monorepo with multiple workspaces, each handling different file types:

- **`main/`** - Main application and file routing
- **`components/`** - Shared React components
- File type handlers:
    - **`hex_viewer/`** - Binary file viewer
    - **`archive/`** - Archive file handlers (ZIP, RAR, etc.)
    - **`binaryxml/`** - Android binary XML parser
    - **`classfile/`** - Java class file viewer
    - **`dexviewer/`** - Android DEX file viewer
    - **`imagemagick/`** - Image file processing
    - **`ffmpeg/`** - Audio/video file handling
    - **`markdown/`** - Markdown renderer
    - **`textviewer/`** - Text file viewer
    - **`wat_viewer/`** - WebAssembly text format viewer
    - **`webgl_previewer/`** - 3D model previewer

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run serve
   ```

3. Open your browser to `http://localhost:3000`

### Available Scripts

- `npm start` - Start the development server
- `npm run build` - Build all workspaces
- `npm run build:workspaces` - Build all workspaces
- `npm run watch:workspaces` - Watch all workspaces for changes
- `npm test` - Run tests across all workspaces

## Adding New File Handlers

To add support for a new file type:

1. Create a new workspace directory in the root
2. Set up the basic structure:
   ```
   new_handler/
   ├── build.mjs
   ├── index.html
   ├── main.tsx
   ├── package.json
   └── src/
   ```

3. Add the workspace to the root `package.json` workspaces array

4. Implement the file handler following the established patterns:
   - React is preferred for the UI, but you may use any framework or approach as long as you follow the API described in the README.md (i.e., the `requestFile`/`respondFile` messaging protocol).
   - Handle file processing in the main component or entry point.
   - Implement proper error handling.
   - Add appropriate file type detection.

5. Update the main application's file type detection in `main/handlers.ts`

### Handler Implementation Example

```typescript
// main.tsx
import React, { useEffect, useState } from 'react';

interface FileData {
  file: File;
  originalType?: string;
}

const NewHandler: React.FC = () => {
  const [fileData, setFileData] = useState<FileData | null>(null);

  useEffect(() => {
    // Request file from parent window
    if (window.parent) {
      window.parent.postMessage({ action: 'requestFile' });
    }

    // Listen for file responses
    const handleMessage = (e: MessageEvent) => {
      if (e.data.action === 'respondFile') {
        setFileData({
          file: e.data.file,
          originalType: e.data.originalType
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const processFile = async (file: File) => {
    try {
      // Implement your file processing logic here
      const content = await file.text();
      // Process and display the content
    } catch (error) {
      console.error('Error processing file:', error);
    }
  };

  useEffect(() => {
    if (fileData) {
      processFile(fileData.file);
    }
  }, [fileData]);

  return (
    <div className="new-handler">
      <h1>New File Handler</h1>
      {fileData ? (
        <div>
          <p>Processing: {fileData.file.name}</p>
          {/* Add your UI components here */}
        </div>
      ) : (
        <p>Waiting for file...</p>
      )}
    </div>
  );
};

export default NewHandler;
```

## Contributing Guidelines

### Code Style

- Use TypeScript for all new code
- Follow the existing code formatting and structure
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Keep components focused and single-purpose

### File Naming

- Use kebab-case for file and directory names
- Use PascalCase for React components
- Use camelCase for variables and functions

## Testing

Each workspace should include appropriate tests:

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test file handling workflows
3. **E2E Tests**: Test complete user workflows

Run tests:
```bash
# Run all tests
npm test

# Run tests for a specific workspace
npm test -w hex_viewer

# Run tests in watch mode
npm test -- --watch
```

### Test Structure

```typescript
// handler.test.tsx
import { render, screen } from '@testing-library/react';
import NewHandler from './main';

describe('NewHandler', () => {
  it('should display waiting message initially', () => {
    render(<NewHandler />);
    expect(screen.getByText('Waiting for file...')).toBeInTheDocument();
  });

  // Add more tests...
});
```

## Building

### Build

```bash
npm run build
```

### Individual Workspace Build

```bash
npm run build -w workspace-name
```

## WASM Integration

Many handlers use WebAssembly for performance-critical operations:

- **Rust WASM**: Use `wasm-pack` for compilation
- **Go WASM**: Use `GOOS=js GOARCH=wasm go build`
- **C/C++ WASM**: Use Emscripten

Ensure WASM files are properly bundled and accessible in the browser.

## Hermeticity

- As much as possible, prefer loading dependencies via NPM and bundle those in the dist/ output directory instead of loading them from a CDN.
- If a handler needs to load javascript and or fetch data external to the tool itself, note that in the README.md of the handler.

Thank you for contributing to FileMagic! 🚀
