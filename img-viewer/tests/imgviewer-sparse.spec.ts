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
