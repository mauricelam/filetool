import { FileChunkReader, readInChunks, readByteRange, formatBytes, DEFAULT_CHUNK_SIZE } from './largeFile';

describe('FileChunkReader and Large File Utilities', () => {
    function createMockFile(size: number, name = 'large_sample.bin'): File {
        const buffer = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            buffer[i] = i % 256;
        }
        return new File([buffer], name, { type: 'application/octet-stream' });
    }

    describe('formatBytes', () => {
        test('formats bytes correctly', () => {
            expect(formatBytes(0)).toBe('0 Bytes');
            expect(formatBytes(1024)).toBe('1 KB');
            expect(formatBytes(1048576)).toBe('1 MB');
            expect(formatBytes(1073741824)).toBe('1 GB');
            expect(formatBytes(5368709120)).toBe('5 GB');
            expect(formatBytes(1500, 1)).toBe('1.5 KB');
        });
    });

    describe('FileChunkReader', () => {
        test('calculates totalChunks correctly', () => {
            const chunkSize = 1000;
            const file1 = createMockFile(2500);
            const reader1 = new FileChunkReader(file1, chunkSize);
            expect(reader1.totalChunks).toBe(3);
            expect(reader1.totalSize).toBe(2500);

            const file2 = createMockFile(1000);
            const reader2 = new FileChunkReader(file2, chunkSize);
            expect(reader2.totalChunks).toBe(1);

            const file3 = createMockFile(0);
            const reader3 = new FileChunkReader(file3, chunkSize);
            expect(reader3.totalChunks).toBe(1);
        });

        test('getChunk returns correct ChunkInfo metadata and slice content', async () => {
            const file = createMockFile(2500);
            const reader = new FileChunkReader(file, 1000);

            const chunk0 = await reader.getChunk(0);
            expect(chunk0.index).toBe(0);
            expect(chunk0.offset).toBe(0);
            expect(chunk0.size).toBe(1000);
            expect(chunk0.isLast).toBe(false);
            expect(chunk0.totalSize).toBe(2500);

            const chunk2 = await reader.getChunk(2);
            expect(chunk2.index).toBe(2);
            expect(chunk2.offset).toBe(2000);
            expect(chunk2.size).toBe(500);
            expect(chunk2.isLast).toBe(true);

            const bytes = new Uint8Array(await chunk2.data.arrayBuffer());
            expect(bytes.length).toBe(500);
            expect(bytes[0]).toBe(2000 % 256);
        });

        test('readRange retrieves specific byte ranges', async () => {
            const file = createMockFile(5000);
            const reader = new FileChunkReader(file, 1000);

            const rangeData = await reader.readRange(10, 5);
            expect(rangeData.length).toBe(5);
            expect(rangeData[0]).toBe(10);
            expect(rangeData[4]).toBe(14);

            const outOfBounds = await reader.readRange(4995, 20);
            expect(outOfBounds.length).toBe(5);
        });

        test('chunkStream yields all chunk slices sequentially', async () => {
            const file = createMockFile(3200);
            const reader = new FileChunkReader(file, 1000);

            const chunks = [];
            for await (const chunk of reader.chunkStream()) {
                chunks.push(chunk);
            }

            expect(chunks.length).toBe(4);
            expect(chunks[0].size).toBe(1000);
            expect(chunks[1].size).toBe(1000);
            expect(chunks[2].size).toBe(1000);
            expect(chunks[3].size).toBe(200);
            expect(chunks[3].isLast).toBe(true);
        });

        test('processInChunks allows early termination when callback returns false', async () => {
            const file = createMockFile(5000);
            const reader = new FileChunkReader(file, 1000);

            let processedCount = 0;
            await reader.processInChunks((chunk) => {
                processedCount++;
                if (chunk.index === 1) return false;
            });

            expect(processedCount).toBe(2);
        });
    });

    describe('standalone helpers', () => {
        test('readInChunks helper works properly', async () => {
            const file = createMockFile(1500);
            let totalProcessedBytes = 0;

            await readInChunks(file, (chunk) => {
                totalProcessedBytes += chunk.size;
            }, 1000);

            expect(totalProcessedBytes).toBe(1500);
        });

        test('readByteRange helper works properly', async () => {
            const file = createMockFile(500);
            const bytes = await readByteRange(file, 100, 50);
            expect(bytes.length).toBe(50);
            expect(bytes[0]).toBe(100);
        });
    });
});
