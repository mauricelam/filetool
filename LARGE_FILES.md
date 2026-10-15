# Handling Large Files (>4GB) in Filetool Architecture

## Overview

Modern web browsers operate within specific memory constraints:
1. **ArrayBuffer and V8 Heap Limits**: Browsers enforce an allocation cap per `ArrayBuffer` or TypedArray (typically ~2GB to 4GB depending on browser architecture and available system RAM). Attempting to allocate an `ArrayBuffer` larger than these limits throws an unhandled `RangeError: Array buffer allocation failed` or `NotReadableError`.
2. **WebAssembly Memory Limits (wasm32)**: Standard 32-bit WebAssembly modules can address up to 4GB ($2^{32}$ bytes) of linear memory. Loading a file larger than 2GB–4GB directly into a WASM module's memory heap will exceed the module bounds or trigger memory allocation panics.
3. **32-Bit Bitwise Truncation in JavaScript**: In JavaScript, bitwise operators (such as `a | 0`, `a >> 0`, `a >>> 0`) cast double-precision numbers to 32-bit signed or unsigned integers ($2^{31}-1 = 2,147,483,647$ or $2^{32}-1 = 4,294,967,295$). File size offsets exceeding 4GB are truncated or wrapped around when using bitwise math.

Filetool provides zero-copy transfer and lazy range-based reading capabilities so that files of arbitrary size (including >4GB, >100GB, or Multi-Gigabyte files) can be handled gracefully without crashing viewer iframes or throwing unhandled exceptions.

---

## Architecture and Shared Mechanism (`@filetool/common`)

All viewers share utilities exported by `@filetool/common` (`filetool-common/largeFile.ts`):

### Key Shared Utilities (`filetool-common/largeFile.ts`)

- **`safeSliceFile(file: Blob | File, start?: number, end?: number): Blob`**:
  Uses double-precision floating-point arithmetic (safe up to $2^{53}-1 \approx 9$ Petabytes) to clamp slice boundaries without 32-bit bitwise overflow.

- **`readByteRange(file: Blob | File, offset: number, length: number): Promise<Uint8Array>`**:
  Asynchronously reads a specific byte range from a `File` or `Blob` into a `Uint8Array` without loading the full file into memory.

- **`readInChunks(file: Blob | File, options)`**:
  Sequentially reads a large file in configurable chunk sizes (e.g., 16MB or 64MB) without allocating the entire file size in heap memory.

- **`FileChunkReader`**:
  Class for random-access chunk reading on `File`/`Blob` objects.

- **`safeReadFile(file: File, options?: { maxBytes?: number })`**:
  Safely reads a `File`. If `file.size` exceeds `maxBytes` (default 50MB) or if `file.arrayBuffer()` throws an allocation error (e.g. on 4GB+ files), `safeReadFile` automatically falls back to slicing the first `maxBytes` bytes and returns `{ buffer, isTruncated: true, totalSize: file.size }`.

- **`isExceeding4GB(file: Blob | File): boolean`** & **`formatBytes(bytes: number): string`**:
  Helper functions to check for 4GB+ thresholds and render human-readable file sizes (e.g. `5.00 GB`).

---

## Viewer Strategies

Viewers in Filetool are categorized into three operational strategies:

### 1. Lazy Range & Chunk Streaming (Unlimited File Size)
- **Examples**: `hex_viewer`, `img-viewer` (ext4/EROFS filesystems).
- **Mechanism**: Reads byte offsets directly from `File` using `File.slice()` and `FileReaderSync` or `readByteRange` on-demand as the user scrolls or requests files. Virtualized viewport rendering handles arbitrarily large files (>100GB) with $O(1)$ constant memory overhead.

### 2. Safe-Slicing & Text / Structural Preview (Truncation Warning Banner)
- **Examples**: `textviewer`, `markdown`, `mhtml`, `jqviewer`, `svgviewer`, `proguardviewer`, `rstviewer`, `graphviz`, `android-xml`, `cborviewer`, `flatbuffers`, `wat_viewer`, `protoscope`, `der`, `bplistviewer`, `classfile`, `diffviewer`.
- **Mechanism**: Slices the initial safe portion (e.g., 10MB to 50MB) using `safeReadFile`. If the file is larger than the safe preview threshold, renders the preview and displays a prominent **Truncation Warning Banner** (`#truncation-warning`) informing the user that the first N MB is displayed out of the total file size.

### 3. Safe Buffer & Error-Guarded WASM / Heavy Parsers
- **Examples**: `apk-viewer`, `archive`, `binutils`, `cheerpj`, `decompressor`, `dexviewer`, `dmg-viewer`, `ffmpeg`, `ghidra`, `hprof`, `imagemagick`, `ooxmlviewer`, `parquetviewer`, `pdfjs`, `setools`, `sqliteviewer`, `squashfs`, `webgl_previewer`.
- **Mechanism**: Wraps full file buffer reads in `safeReadFile` or `try-catch` error boundaries. If a file exceeds WASM heap or RAM limits (e.g. >2GB/4GB), the error is caught gracefully and a user-friendly error/warning banner is displayed instead of letting the iframe crash or freeze with an uncaught exception.

---

## Best Practices for Tool Authors

1. **Never call `await file.arrayBuffer()` or `await file.text()` directly without a size check or `try-catch` block.**
2. **Use `safeReadFile(file, { maxBytes })`** from `@filetool/common` when loading file contents into memory.
3. **Display user feedback** (truncation notice or memory warning banner) when file contents are truncated or exceed RAM/WASM limits.
