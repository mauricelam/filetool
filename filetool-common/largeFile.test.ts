import { describe, it, expect } from 'vitest';
import {
    formatBytes,
    isExceeding4GB,
    safeSliceFile,
    readByteRange,
    readInChunks,
    FileChunkReader,
    safeReadFile,
    FOUR_GB
} from './largeFile';

describe('largeFile utilities', () => {
    describe('formatBytes', () => {
        it('formats byte sizes correctly', () => {
            expect(formatBytes(0)).toBe('0 Bytes');
            expect(formatBytes(1024)).toBe('1 KB');
            expect(formatBytes(1024 * 1024)).toBe('1 MB');
            expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
            expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5 GB');
        });
    });

    describe('isExceeding4GB', () => {
        it('identifies files larger than 4GB', () => {
            const smallBlob = { size: 100 } as Blob;
            const large4GBBlob = { size: FOUR_GB + 1000 } as Blob;

            expect(isExceeding4GB(smallBlob)).toBe(false);
            expect(isExceeding4GB(large4GBBlob)).toBe(true);
        });
    });

    describe('safeSliceFile', () => {
        it('clamps negative or out-of-bound ranges safely', () => {
            const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            const blob = new Blob([data]);

            const slice1 = safeSliceFile(blob, -5, 5);
            expect(slice1.size).toBe(5);

            const slice2 = safeSliceFile(blob, 2, 100);
            expect(slice2.size).toBe(8);
        });
    });

    describe('FileChunkReader and readByteRange', () => {
        it('reads byte ranges from blob', async () => {
            const data = new Uint8Array([65, 66, 67, 68, 69, 70]);
            const blob = new Blob([data]);

            const bytes = await readByteRange(blob, 1, 3);
            expect(Array.from(bytes)).toEqual([66, 67, 68]);

            const reader = new FileChunkReader(blob);
            expect(reader.size).toBe(6);
            const text = await reader.readText(2, 3);
            expect(text).toBe('CDE');
        });
    });

    describe('readInChunks', () => {
        it('reads blob sequentially in specified chunk sizes', async () => {
            const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            const blob = new Blob([data]);

            const chunks: Uint8Array[] = [];
            await readInChunks(blob, {
                chunkSize: 3,
                onChunk: (chunk) => {
                    chunks.push(chunk);
                }
            });

            expect(chunks.length).toBe(4);
            expect(Array.from(chunks[0])).toEqual([1, 2, 3]);
            expect(Array.from(chunks[1])).toEqual([4, 5, 6]);
            expect(Array.from(chunks[2])).toEqual([7, 8, 9]);
            expect(Array.from(chunks[3])).toEqual([10]);
        });
    });

    describe('safeReadFile', () => {
        it('reads full buffer for files up to 4GB and truncates when exceeding maxBytes', async () => {
            const data = new Uint8Array(1000);
            data.fill(42);
            const file = new File([data], 'test.bin');

            const resultFull = await safeReadFile(file);
            expect(resultFull.isTruncated).toBe(false);
            expect(resultFull.buffer.length).toBe(1000);
            expect(resultFull.totalSize).toBe(1000);

            const resultTruncated = await safeReadFile(file, { maxBytes: 500 });
            expect(resultTruncated.isTruncated).toBe(true);
            expect(resultTruncated.buffer.length).toBe(500);
            expect(resultTruncated.totalSize).toBe(1000);
        });
    });
});
