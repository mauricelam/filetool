## File tool

Vibe coded WASM file inspection tool in the browser: https://mauricelam.github.io/filetool/main/

The idea is that you drag a file into the tool, using the browser sandbox, be able to inspect the contents of the file.

## Default File Handlers

This application now supports setting a default file handler for specific file types. This allows you to customize how files are opened, streamlining your workflow.

### How it Works
- When you open a file, the application determines its mimetype (e.g., `text/plain`, `application/pdf`).
- If multiple handlers are available for that mimetype, you will see buttons to open the file with each handler.
- Next to each "Open with..." button, you will find a "Set as default" button.

### Setting a Default Handler
- To set a default handler for the current file's type (based on its mimetype), simply click the "Set as default" button next to your preferred handler.
- An alert will confirm that the default has been set.

### Benefits
- Once a default handler is set for a mimetype, any subsequent files of that same type will automatically open with your chosen handler. You will no longer need to manually select a handler each time.
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
