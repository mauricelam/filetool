# `@filetool/common`

Shared protocol definitions, IPC messaging types, and large file (>4GB) processing utilities for Filetool viewers.

## Modules

### `messages.ts`
IPC messaging types (`RequestFileMessage`, `RespondFileMessage`, `OpenFileMessage`, `IframeMessage`) used across parent and viewer iframe windows.

### `largeFile.ts`
Utilities for handling large files (>4GB) safely in browser environments without memory allocation crashes or 32-bit offset overflows:

- `safeSliceFile(file, start, end)`: Double-precision slice clamping.
- `readByteRange(file, offset, length)`: Async chunk range reader.
- `readInChunks(file, options)`: Sequential chunked streaming.
- `FileChunkReader`: Object wrapper for random-access chunk reading on `File`/`Blob`.
- `safeReadFile(file, options)`: Safely reads `file` up to `maxBytes` or catches `ArrayBuffer` allocation failures, returning `{ buffer, isTruncated, totalSize }`.
- `isExceeding4GB(file)`: Returns true if `file.size > 4 * 1024 * 1024 * 1024`.
- `formatBytes(bytes)`: Formats byte counts as human readable string (`GB`, `MB`, `KB`, `Bytes`).
