export interface FileSliceOptions {
    chunkSize?: number;
}

export interface ChunkInfo {
    index: number;
    offset: number;
    size: number;
    totalSize: number;
    isLast: boolean;
    data: Blob;
}

export const DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB per slice chunk

/**
 * FileChunkReader provides a unified mechanism across all viewers to process arbitrarily
 * large files (>4GB) by breaking them down into manageable sequential or random-access slices.
 */
export class FileChunkReader {
    private file: File;
    private chunkSize: number;

    constructor(file: File, chunkSize: number = DEFAULT_CHUNK_SIZE) {
        this.file = file;
        this.chunkSize = chunkSize;
    }

    get totalSize(): number {
        return this.file.size;
    }

    get totalChunks(): number {
        return Math.ceil(this.file.size / this.chunkSize) || 1;
    }

    /**
     * Reads a specific byte range slice safely from the file without buffering the whole file in memory.
     */
    async readRange(offset: number, length: number): Promise<Uint8Array> {
        const start = Math.max(0, Math.min(offset, this.file.size));
        const end = Math.min(start + length, this.file.size);
        const slice = this.file.slice(start, end);
        const buffer = await slice.arrayBuffer();
        return new Uint8Array(buffer);
    }

    /**
     * Reads a specific slice chunk by 0-based chunk index.
     */
    async getChunk(index: number): Promise<ChunkInfo> {
        const offset = index * this.chunkSize;
        const size = Math.min(this.chunkSize, Math.max(0, this.file.size - offset));
        const data = this.file.slice(offset, offset + size);
        const isLast = offset + size >= this.file.size;
        return {
            index,
            offset,
            size,
            totalSize: this.file.size,
            isLast,
            data
        };
    }

    /**
     * Async generator iterating over sequential chunk slices across multi-GB files.
     */
    async *chunkStream(): AsyncIterableIterator<ChunkInfo> {
        const count = this.totalChunks;
        for (let i = 0; i < count; i++) {
            yield await this.getChunk(i);
        }
    }

    /**
     * Iteratively processes all chunk slices of a file with a callback function.
     */
    async processInChunks(
        callback: (chunk: ChunkInfo) => Promise<boolean | void> | boolean | void
    ): Promise<void> {
        for await (const chunk of this.chunkStream()) {
            const stop = await callback(chunk);
            if (stop === false) {
                break;
            }
        }
    }
}

/**
 * Convenience helper to iteratively process a large File in small slices.
 */
export async function readInChunks(
    file: File,
    callback: (chunk: ChunkInfo) => Promise<boolean | void> | boolean | void,
    chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<void> {
    const reader = new FileChunkReader(file, chunkSize);
    await reader.processInChunks(callback);
}

/**
 * Reads a range slice from a file.
 */
export async function readByteRange(
    file: File,
    offset: number,
    length: number
): Promise<Uint8Array> {
    const reader = new FileChunkReader(file);
    return reader.readRange(offset, length);
}

/**
 * Formats byte sizes into human-readable strings (e.g. "4.20 GB").
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
