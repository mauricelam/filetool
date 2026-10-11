# Architecture and Design for Large File Support (>4GB)

## Overview
`filetool` is a web-based file analysis platform comprising a host application (`main`) and numerous specialized viewer modules hosted inside isolated `<iframe>` sandboxes. Previously, the host shell transferred file data to viewer iframes by reading up to 100 MB into an `ArrayBuffer` and posting transferable buffers. This approach faced critical scalability issues for files larger than 4GB (or even >100 MB):
1. Eager buffer allocation attempted to load entire or large portions of multi-gigabyte files into JavaScript heap memory, triggering `RangeError: ArrayBuffer allocation failed` or V8 string length limit exceptions.
2. Unnecessary copying and buffer transfer overhead delayed initial viewer rendering.

To support files arbitrarily larger than 4GB (limited only by the operating system and browser file system limits, as JavaScript `Number.MAX_SAFE_INTEGER` allows offsets up to 9 Petabytes), a general, zero-copy, lazy-loading mechanism was designed and implemented across the system via the `@filetool/common` helper utilities.

---

## Core Architecture & Key Principles

### 1. Zero-Copy File Reference Transfer via Structured Clone Algorithm
In the HTML5 standard, the `File` interface inherits from `Blob`. `File` objects are lightweight handles containing metadata (filename, size, MIME type, last modified timestamp) and an internal handle pointer to the file on disk.

When a `File` object is sent across `window.postMessage` between window boundaries (e.g. Host Shell to Viewer `<iframe>`), the browser uses the **Structured Clone Algorithm**. Instead of copying raw file bytes across the message channel:
- The browser transfers the lightweight handle reference in $O(1)$ time and memory.
- The receiving iframe receives a full, functional `File` instance capable of slicing and reading any range of the underlying file on demand.

### 2. Streamlined Host Shell (`IframeManager.tsx`)
The Host Shell's `IframeManager` acts as the central router for file payloads requested by active viewer instances via the `requestFile` / `respondFile` protocol.

**Changes:**
- Removed eager `file.slice(0, 100MB).arrayBuffer()` loading and transferable `ArrayBuffer` management.
- When an iframe posts `{ action: 'requestFile' }`, the host directly sends `{ action: 'respondFile', file, originalType, additionalFiles }` containing the raw `File` object handles.
- Message delivery is instant, zero-memory, and independent of file size.

### 3. Shared Large File Helper (`@filetool/common/largeFile`)
A common abstraction `safeSliceFile` and `formatBytes` is provided in `@filetool/common` to standardize safe buffer slicing, size checks, and human-readable truncation reporting across all viewers.

```typescript
export interface FileSliceResult {
    file: File;
    slice: Blob;
    isTruncated: boolean;
    totalSize: number;
    sliceSize: number;
}

export function safeSliceFile(file: File, maxBytes: number = 100 * 1024 * 1024): FileSliceResult;
```

### 4. Layered Processing Strategies for Viewer Implementations

Viewers in `filetool` are categorized into two primary processing paradigms based on file format structure:

#### Paradigm A: Chunked & On-Demand Viewers (Lazy Random Access)
Used by viewers inspecting large structured formats, binary dumps, or filesystem images:
- **`hex_viewer`**: Uses virtualized canvas rendering combined with sliding-window `file.slice(offset, offset + length)` buffer reads. It can display 10GB+ files seamlessly without loading more than a few megabytes into memory at any given time.
- **`img-viewer` (ext4 / EROFS / Sparse / LPMeta)**: Reads superblock metadata and translates logical partition offset requests on demand using `file.slice()`. WebAssembly modules (`ext4-wasm`, `erofs-wasm`) utilize lazy Emscripten file wrappers (`FS.createLazyFile`) or synchronous chunk fetching via Web Workers (`FileReaderSync`).
- **`sqliteviewer`**: Executes SQL queries over database files using WASM with page-level virtual filesystem (VFS) chunk fetching on demand / safe chunking.
- **`diffviewer`**: Uses block-level diffing in a Web Worker, loading sliding binary windows via `file.slice()` and displaying virtualized hex/text diff lines.

#### Paradigm B: Safe Buffer Ingestion Safeguards (Whole-File / Dense Formats)
For format viewers that require contiguous memory or whole-file parsing in WebAssembly/JS (e.g., compressed archives, PDFs, text/code highlighters, WASM tools):
- **Safe Single-Buffer Thresholding**: A standard safe memory threshold (e.g., 50MB – 100MB via `safeSliceFile`) is applied.
- **Truncated Preview / Sliced Access**:
  - When file size exceeds the safe contiguous buffer threshold (e.g. >100MB or >4GB), the viewer safely slices the initial header / preview chunk (`file.slice(0, SAFE_MAX_SIZE)`).
  - The viewer renders the available preview data along with an informative UI banner stating that the file exceeds full-memory buffer limits and displays the total file size.

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
