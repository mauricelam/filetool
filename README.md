## File tool

Vibe coded WASM file inspection tool in the browser: https://mauricelam.github.io/filetool/main/

The idea is that you drag a file into the tool, using the browser sandbox, be able to inspect the contents of the file.

## Default File Handlers

This application now supports setting a default file handler for specific file types. This allows you to customize how files are opened, streamlining your workflow.

### How it Works
- When you open a file, the application determines its mimetype (e.g., `text/plain`, `application/pdf`).
- If a default handler is set for that mimetype, the file will be opened using it automatically.
- Buttons for all applicable handlers will be displayed. If a default is set, it will be visually indicated (e.g., the "Set as default" button for that handler will show "✓ Default").
- Next to each "Open with..." button, you will find a "Set as default" button (or "✓ Default" if it's already the default).

### Setting a Default Handler
- To set a default handler for the current file's type (based on its mimetype), simply click the "Set as default" button next to your preferred handler (if it's not already the default).
- An alert will confirm that the default has been set.

### Benefits
- Once a default handler is set for a mimetype, any subsequent files of that same type will automatically be opened and processed by your chosen default handler.
- While the file is opened by default, the full list of available handlers remains visible. This allows you to easily open the file with a different, non-default handler if needed for a specific task.
- The currently set default handler will be visually indicated in the list (e.g., its "Set as default" button will appear as "✓ Default" and be disabled).
- Your default handler preferences are stored locally in your web browser's `localStorage`.

## Cross-iframe Communication

The application uses postMessage for communication between the main window and tool iframes. Here's the message format specification:

### Tool to Main Window Messages

1. Request File
```javascript
{
    action: 'requestFile'
}
```
Sent by a tool when it is loaded and ready to process a file. The main window will respond with a `respondFile` message.

2. Open File
```javascript
{
    action: 'openFile',
    file: File  // The file to open in a new tool
}
```
Sent by a tool when it wants to open a new file in another tool (e.g., when extracting a file from an archive).

### Main Window to Tool Messages

1. Respond File
```javascript
{
    action: 'respondFile',
    file: File,  // The file to process
    originalType: string  // Optional: The original MIME type of the file
}
```
Sent by the main window in response to a `requestFile` message. Contains the file to be processed by the tool.

### Implementation Details

1. Each tool should initialize by sending a `requestFile` message if it's in an iframe:
```javascript
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' })
}
```

2. Each tool should listen for the `respondFile` message:
```javascript
window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}
```
