# Architecture and Design for Large File Support (>4GB)

## Overview
`filetool` is a web-based file analysis platform comprising a host application (`main`) and numerous specialized viewer modules hosted inside isolated `<iframe>` sandboxes. Previously, the host shell transferred file data to viewer iframes by reading up to 100 MB into an `ArrayBuffer` and posting transferable buffers. This approach faced critical scalability issues for files larger than 4GB (or even >100 MB):
1. Eager buffer allocation attempted to load entire or large portions of multi-gigabyte files into JavaScript heap memory, triggering `RangeError: ArrayBuffer allocation failed` or V8 string length limit exceptions.
2. Unnecessary copying and buffer transfer overhead delayed initial viewer rendering.
3. Simply truncating files at a single static offset loses data and breaks multi-GB file viewing.

To support files arbitrarily larger than 4GB (limited only by the operating system and browser file system limits, as JavaScript `Number.MAX_SAFE_INTEGER` allows offsets up to 9 Petabytes), a general, zero-copy, chunked slice mechanism was designed and implemented across the system via `@filetool/common`.

---

## Core Architecture & Key Principles

### 1. Zero-Copy File Reference Transfer via Structured Clone Algorithm
In the HTML5 standard, the `File` interface inherits from `Blob`. `File` objects are lightweight handles containing metadata (filename, size, MIME type, last modified timestamp) and an internal handle pointer to the file on disk.

When a `File` object is sent across `window.postMessage` between window boundaries (e.g. Host Shell to Viewer `<iframe>`), the browser uses the **Structured Clone Algorithm**. Instead of copying raw file bytes across the message channel:
- The browser transfers the lightweight handle reference in $O(1)$ time and memory.
- The receiving iframe receives a full, functional `File` instance capable of slicing and reading any range of the underlying file on demand.

### 2. Shared Chunked Reader Utility (`@filetool/common/largeFile`)
To handle files of any size by breaking them down into smaller slices, `@filetool/common` provides `FileChunkReader`, `readInChunks`, and `readByteRange`.

```typescript
export class FileChunkReader {
    constructor(file: File, chunkSize: number = 16 * 1024 * 1024);
    get totalChunks(): number;
    async readRange(offset: number, length: number): Promise<Uint8Array>;
    async getChunk(index: number): Promise<ChunkInfo>;
    async *chunkStream(): AsyncIterableIterator<ChunkInfo>;
    async processInChunks(callback: (chunk: ChunkInfo) => Promise<boolean | void>): Promise<void>;
}
```

### 3. Layered Processing Strategies for Viewer Implementations

Viewers in `filetool` process multi-GB files using chunked slice strategies suited to their data structures:

#### Paradigm A: Chunked & Streaming Slices (Sequential Processing)
- **`textviewer`**: Loads initial chunk slices on launch and supports chunked slice pagination/loading as needed for multi-GB files.
- **`binutils` / `decompressor`**: Streams 16MB slices iteratively through WASM or processing pipelines.

#### Paradigm B: On-Demand Random Access Slices (Virtual File Systems & Sliding Windows)
- **`hex_viewer`**: Uses virtualized canvas rendering combined with sliding-window `file.slice(offset, offset + length)` buffer reads (`readByteRange`).
- **`img-viewer` (ext4 / EROFS / Sparse / LPMeta)**: Reads superblock metadata and translates logical partition offset requests on demand using `file.slice()`. WebAssembly modules utilize lazy Emscripten file wrappers (`FS.createLazyFile`) or synchronous chunk fetching via Web Workers (`FileReaderSync`).
- **`sqliteviewer`**: Executes SQL queries over multi-GB database files using page-level or chunked slice VFS fetching on demand.
- **`diffviewer`**: Uses block-level diffing in a Web Worker, loading sliding binary windows via `file.slice()`.

---

## Standardized Message Protocol

The communication protocol in `filetool-common` remains backwards-compatible:

```typescript
// Request from iframe to parent shell
export type RequestFileMessage = {
    action: 'requestFile';
};

// Response from parent shell to iframe
export type RespondFileMessage = {
    action: 'respondFile';
    file: File;               // Raw File handle (structured clone)
    originalType?: string;
    additionalFiles?: File[];
};
```

---

## Verification & Compatibility Matrix
- **JavaScript Safe Integer Limits**: All offset calculations use standard JS numbers or BigInt. JS `Number.MAX_SAFE_INTEGER` ($2^{53} - 1 = 9,007,199,254,740,991$ bytes $\approx 9$ PB) fully accommodates 64-bit file offsets.
- **Browser Sandboxing**: `File` references transferred via `postMessage` maintain full `Blob.slice()` capabilities across sandboxed `<iframe>` boundaries under `allow-scripts allow-same-origin`.
- **Worker Offloading**: `File` objects are passed directly to `WebWorker` instances via `postMessage`, enabling non-blocking background parsing for large files.
