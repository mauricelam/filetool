# CheerpJ Handler

A handler that runs Java applications in the browser using CheerpJ technology.

## Features

- Run Java applications in the browser
- Support for Java Swing and AWT applications
- File system emulation
- Network access capabilities
- Java applet support
- Cross-platform Java execution

## Supported File Types

- **.jar** - Java archive files
- **.class** - Java class files
- **Java applications** - Executable Java programs

## Usage

1. Drag and drop a Java application file into the main application
2. The CheerpJ handler will automatically open for supported files
3. The Java application will start in the browser
4. Interact with the application using mouse and keyboard
5. Access file system and network features

## Implementation Details

- Built with CheerpJ (Java to JavaScript compiler)
- Runs Java applications entirely in the browser
- Implements the standard `requestFile`/`respondFile` messaging protocol
- **Internet Access**: Requires internet access to load the CheerpJ runtime from `https://cjrtnc.leaningtech.com`.

## Dependencies

- **CheerpJ** - Java to JavaScript compiler and runtime (loaded via CDN)

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
cheerpj/
├── build.mjs          # Build configuration
├── index.html         # Entry point
├── main.tsx           # Main React component
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Technical Architecture

- **main.tsx** - React component that handles Java application loading and execution

The handler uses CheerpJ to compile and run Java applications in the browser. Java applications are executed in a sandboxed environment with access to virtual file system and network APIs.

## Java Runtime Features

- **JVM Emulation** - Complete Java Virtual Machine
- **Swing/AWT Support** - Graphical user interface rendering
- **File System** - Virtual file system for Java applications
- **Network Access** - HTTP and socket support
- **Threading** - Multi-threaded Java application support
- **Reflection** - Full Java reflection capabilities

## Application Support

- **Desktop Applications** - Java Swing and AWT apps
- **Command Line Tools** - Console-based Java applications
- **Java Applets** - Legacy applet support
- **Libraries** - Java library execution and testing

## Performance Considerations

- **Startup Time** - Initial JVM initialization
- **Memory Usage** - Browser memory management
- **Execution Speed** - JavaScript-based Java execution
- **File I/O** - Virtual file system performance
- **Network** - Browser network access limitations

## Use Cases

- **Legacy Applications** - Running old Java applications
- **Development** - Testing Java code in the browser
- **Education** - Java programming demonstrations
- **Portable Apps** - Cross-platform Java application delivery
