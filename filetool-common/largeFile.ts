/**
 * 4GB in bytes (2^32 = 4,294,967,296 bytes)
 */
export const FOUR_GB = 4 * 1024 * 1024 * 1024;

/**
 * Default safe threshold for loading entire file into memory (50MB).
 */
export const DEFAULT_MAX_SAFE_BYTES = 50 * 1024 * 1024;

/**
 * Formats byte counts into human-readable string representation.
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return `${parseFloat(value.toFixed(2))} ${sizes[i]}`;
}

/**
 * Checks whether a File or Blob exceeds 4GB in size.
 */
export function isExceeding4GB(file: Blob | File): boolean {
    return file.size > FOUR_GB;
}

/**
 * Safely slices a File or Blob without 32-bit integer arithmetic truncation.
 * In JS, file.size is a double float safe up to 2^53-1 (~9PB).
 */
export function safeSliceFile(file: Blob | File, start: number = 0, end?: number): Blob {
    const totalSize = file.size;
    const safeStart = Math.max(0, Math.min(totalSize, Math.floor(start)));
    const safeEnd = end !== undefined ? Math.max(safeStart, Math.min(totalSize, Math.floor(end))) : totalSize;
    return file.slice(safeStart, safeEnd);
}

/**
 * Reads a specific byte range from a File or Blob asynchronously as a Uint8Array.
 */
export async function readByteRange(file: Blob | File, offset: number, length: number): Promise<Uint8Array> {
    const slice = safeSliceFile(file, offset, offset + length);
    const ab = await slice.arrayBuffer();
    return new Uint8Array(ab);
}

/**
 * Options for chunked reading of large files.
 */
export interface ReadInChunksOptions {
    chunkSize?: number;
    startOffset?: number;
    endOffset?: number;
    onChunk: (chunk: Uint8Array, offset: number, totalSize: number) => Promise<boolean | void> | boolean | void;
}

/**
 * Reads a large File sequentially in chunks to avoid allocating huge memory buffers.
 */
export async function readInChunks(file: Blob | File, options: ReadInChunksOptions): Promise<void> {
    const chunkSize = options.chunkSize || 8 * 1024 * 1024; // 8MB default chunk size
    const totalSize = file.size;
    const startOffset = Math.max(0, options.startOffset || 0);
    const endOffset = options.endOffset !== undefined ? Math.min(totalSize, options.endOffset) : totalSize;

    let currentOffset = startOffset;
    while (currentOffset < endOffset) {
        const currentLength = Math.min(chunkSize, endOffset - currentOffset);
        const chunk = await readByteRange(file, currentOffset, currentLength);
        const shouldContinue = await options.onChunk(chunk, currentOffset, totalSize);
        if (shouldContinue === false) {
            break;
        }
        currentOffset += currentLength;
    }
}

/**
 * Encapsulates random-access chunk reading on a File or Blob.
 */
export class FileChunkReader {
    constructor(public readonly file: Blob | File) {}

    get size(): number {
        return this.file.size;
    }

    async readBytes(offset: number, length: number): Promise<Uint8Array> {
        return readByteRange(this.file, offset, length);
    }

    async readText(offset: number, length: number, encoding: string = 'utf-8'): Promise<string> {
        const bytes = await this.readBytes(offset, length);
        const decoder = new TextDecoder(encoding);
        return decoder.decode(bytes);
    }

    slice(start: number, end?: number): Blob {
        return safeSliceFile(this.file, start, end);
    }
}

/**
 * Result returned by safeReadFile.
 */
export interface SafeReadFileResult {
    buffer: Uint8Array;
    isTruncated: boolean;
    totalSize: number;
}

/**
 * Options for safeReadFile.
 */
export interface SafeReadFileOptions {
    maxBytes?: number;
}

/**
 * Safely reads a File into a Uint8Array buffer.
 * If file.size exceeds maxBytes or if file.arrayBuffer() fails due to V8/browser
 * allocation limits (e.g., on 4GB+ files), it automatically falls back to slicing
 * the initial maxBytes bytes.
 */
export async function safeReadFile(
    file: File | Blob,
    options: SafeReadFileOptions = {}
): Promise<SafeReadFileResult> {
    const totalSize = file.size;
    const maxBytes = options.maxBytes || DEFAULT_MAX_SAFE_BYTES;

    if (totalSize > maxBytes) {
        const slice = safeSliceFile(file, 0, maxBytes);
        try {
            const ab = await slice.arrayBuffer();
            return {
                buffer: new Uint8Array(ab),
                isTruncated: true,
                totalSize
            };
        } catch (err) {
            const fallbackSlice = safeSliceFile(file, 0, 10 * 1024 * 1024);
            const ab = await fallbackSlice.arrayBuffer();
            return {
                buffer: new Uint8Array(ab),
                isTruncated: true,
                totalSize
            };
        }
    }

    try {
        const ab = await file.arrayBuffer();
        return {
            buffer: new Uint8Array(ab),
            isTruncated: false,
            totalSize
        };
    } catch (err) {
        const slice = safeSliceFile(file, 0, Math.min(maxBytes, 10 * 1024 * 1024));
        const ab = await slice.arrayBuffer();
        return {
            buffer: new Uint8Array(ab),
            isTruncated: true,
            totalSize
        };
    }
}
