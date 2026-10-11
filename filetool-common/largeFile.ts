export interface FileSliceOptions {
    maxBytes?: number;
    previewTextLength?: number;
}

export interface FileSliceResult {
    file: File;
    slice: Blob;
    isTruncated: boolean;
    totalSize: number;
    sliceSize: number;
}

export const DEFAULT_MAX_BUFFER_SIZE = 100 * 1024 * 1024; // 100 MB safe threshold

/**
 * Safely slices a File for whole-file parsers or preview viewers, returning
 * metadata about whether the payload was capped due to browser memory constraints.
 */
export function safeSliceFile(file: File, maxBytes: number = DEFAULT_MAX_BUFFER_SIZE): FileSliceResult {
    const isTruncated = file.size > maxBytes;
    const slice = isTruncated ? file.slice(0, maxBytes) : file;
    return {
        file,
        slice,
        isTruncated,
        totalSize: file.size,
        sliceSize: slice.size
    };
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
