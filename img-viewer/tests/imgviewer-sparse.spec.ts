import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

function createSparseImage(rawBuffer: Buffer, blkSize = 4096): Buffer {
    const totalBlocks = Math.ceil(rawBuffer.length / blkSize);

    const fileHdrSz = 28;
    const chunkHdrSz = 12;
    const rawChunkTotalSz = chunkHdrSz + rawBuffer.length;

    const sparseHeader = Buffer.alloc(28);
    sparseHeader.writeUInt32LE(0xED26FF3A, 0); // magic
    sparseHeader.writeUInt16LE(1, 4); // major_version
    sparseHeader.writeUInt16LE(0, 6); // minor_version
    sparseHeader.writeUInt16LE(28, 8); // file_hdr_sz
    sparseHeader.writeUInt16LE(12, 10); // chunk_hdr_sz
    sparseHeader.writeUInt32LE(blkSize, 12); // blk_sz
    sparseHeader.writeUInt32LE(totalBlocks, 16); // total_blks
    sparseHeader.writeUInt32LE(1, 20); // total_chunks
    sparseHeader.writeUInt32LE(0, 24); // checksum

    const chunkHeader = Buffer.alloc(12);
    chunkHeader.writeUInt16LE(0xCAC1, 0); // CHUNK_TYPE_RAW
    chunkHeader.writeUInt16LE(0, 2); // reserved
    chunkHeader.writeUInt32LE(totalBlocks, 4); // chunk_sz in blocks
    chunkHeader.writeUInt32LE(rawChunkTotalSz, 8); // total_sz in bytes

    return Buffer.concat([sparseHeader, chunkHeader, rawBuffer]);
}

test('img-viewer should list files in an Android sparse ext4 image', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/test_ext4.img');
    if (!fs.existsSync(filePath)) {
        throw new Error(`test_ext4.img fixture not found at ${filePath}`);
    }

    const rawBuffer = fs.readFileSync(filePath);
    const sparseBuffer = createSparseImage(rawBuffer);

    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: sparseBuffer,
            name: 'system.img',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.getByText('ext4 Image Explorer')).toBeVisible();
    await expect(iframe.getByText('hello.txt')).toBeVisible();

    await iframe.getByText('hello.txt').click();
    await expect(iframe.getByText('File Details')).toBeVisible();
    await expect(iframe.getByText('/hello.txt')).toBeVisible();
});

test('img-viewer should list files in an Android sparse EROFS image', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/test_erofs.img');
    if (!fs.existsSync(filePath)) {
        throw new Error(`test_erofs.img fixture not found at ${filePath}`);
    }

    const rawBuffer = fs.readFileSync(filePath);
    const sparseBuffer = createSparseImage(rawBuffer);

    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: sparseBuffer,
            name: 'erofs_sparse.img',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.getByText('EROFS Image Explorer')).toBeVisible();
    await expect(iframe.getByText('hello.txt')).toBeVisible();

    await iframe.getByText('hello.txt').click();
    await expect(iframe.getByText('File Details')).toBeVisible();
    await expect(iframe.getByText('/hello.txt')).toBeVisible();
});

test('img-viewer should list files in a large >4GB Android sparse image without memory errors', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/test_ext4.img');
    const rawBuffer = fs.readFileSync(filePath);

    // Create sparse image:
    // Chunk 0: RAW chunk containing test_ext4.img (256 blocks = 1,048,576 bytes)
    // Chunk 1: DONT_CARE chunk containing 1,179,648 blocks (4,831,838,208 bytes)
    // Total virtual unsparsed size = 4,832,886,784 bytes (4.83 GB)
    const blkSize = 4096;
    const rawBlocks = Math.ceil(rawBuffer.length / blkSize);
    const dontCareBlocks = 1179648;
    const totalBlocks = rawBlocks + dontCareBlocks;

    const sparseHeader = Buffer.alloc(28);
    sparseHeader.writeUInt32LE(0xED26FF3A, 0); // magic
    sparseHeader.writeUInt16LE(1, 4); // major_version
    sparseHeader.writeUInt16LE(0, 6); // minor_version
    sparseHeader.writeUInt16LE(28, 8); // file_hdr_sz
    sparseHeader.writeUInt16LE(12, 10); // chunk_hdr_sz
    sparseHeader.writeUInt32LE(blkSize, 12); // blk_sz
    sparseHeader.writeUInt32LE(totalBlocks, 16); // total_blks
    sparseHeader.writeUInt32LE(2, 20); // total_chunks
    sparseHeader.writeUInt32LE(0, 24); // checksum

    const chunk0Header = Buffer.alloc(12);
    chunk0Header.writeUInt16LE(0xCAC1, 0); // CHUNK_TYPE_RAW
    chunk0Header.writeUInt16LE(0, 2);
    chunk0Header.writeUInt32LE(rawBlocks, 4);
    chunk0Header.writeUInt32LE(12 + rawBuffer.length, 8);

    const chunk1Header = Buffer.alloc(12);
    chunk1Header.writeUInt16LE(0xCAC3, 0); // CHUNK_TYPE_DONT_CARE
    chunk1Header.writeUInt16LE(0, 2);
    chunk1Header.writeUInt32LE(dontCareBlocks, 4);
    chunk1Header.writeUInt32LE(12, 8);

    const sparseBuffer = Buffer.concat([sparseHeader, chunk0Header, rawBuffer, chunk1Header]);

    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: sparseBuffer,
            name: 'large_4gb_system.img',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.getByText('ext4 Image Explorer')).toBeVisible();
    await expect(iframe.getByText('hello.txt')).toBeVisible();
});
