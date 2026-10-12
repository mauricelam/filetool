import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

function createSuperImage(partitions: { name: string, data: Buffer }[]): Buffer {
    let currentSector = 2048; // Start at 1MB offset
    const extentsBuffer = Buffer.alloc(partitions.length * 24);
    const partitionsBuffer = Buffer.alloc(partitions.length * 52);

    const payloadBuffers: { offset: number, data: Buffer }[] = [];

    for (let i = 0; i < partitions.length; i++) {
        const p = partitions[i];
        const nameBuf = Buffer.alloc(36);
        nameBuf.write(p.name, 0, 'ascii');
        nameBuf.copy(partitionsBuffer, i * 52);
        partitionsBuffer.writeUInt32LE(1, i * 52 + 36); // attributes
        partitionsBuffer.writeUInt32LE(i, i * 52 + 40); // first_extent_index
        partitionsBuffer.writeUInt32LE(1, i * 52 + 44); // num_extents
        partitionsBuffer.writeUInt32LE(0, i * 52 + 48); // group_index

        const numSectors = BigInt(Math.ceil(p.data.length / 512));
        extentsBuffer.writeBigUInt64LE(numSectors, i * 24 + 0);
        extentsBuffer.writeUInt32LE(0, i * 24 + 8); // target_type LINEAR
        extentsBuffer.writeBigUInt64LE(BigInt(currentSector), i * 24 + 12);
        extentsBuffer.writeUInt32LE(0, i * 24 + 20);

        payloadBuffers.push({ offset: currentSector * 512, data: p.data });
        currentSector += Number(numSectors);
    }

    const totalSize = currentSector * 512;
    const imgBuffer = Buffer.alloc(totalSize);

    imgBuffer.writeUInt32LE(0x616C4467, 4096); // LP_METADATA_GEOMETRY_MAGIC ("gDlA")
    imgBuffer.writeUInt32LE(52, 4096 + 4); // struct_size
    imgBuffer.writeUInt32LE(4096, 4096 + 40); // metadata_max_size
    imgBuffer.writeUInt32LE(2, 4096 + 44); // metadata_slot_count
    imgBuffer.writeUInt32LE(4096, 4096 + 48); // logical_block_size

    const slotOffset = 12288; // 4096 + 4096 * 2 (standard base offset)
    imgBuffer.writeUInt32LE(0x414C5030, slotOffset); // LP_METADATA_HEADER_MAGIC ("0PLA")
    imgBuffer.writeUInt16LE(1, slotOffset + 4);
    imgBuffer.writeUInt16LE(0, slotOffset + 6);
    imgBuffer.writeUInt32LE(104, slotOffset + 8); // header_size

    imgBuffer.writeUInt32LE(0, slotOffset + 80); // partitions_offset
    imgBuffer.writeUInt32LE(partitions.length, slotOffset + 84);
    imgBuffer.writeUInt32LE(52, slotOffset + 88);

    imgBuffer.writeUInt32LE(partitions.length * 52, slotOffset + 92); // extents_offset
    imgBuffer.writeUInt32LE(partitions.length, slotOffset + 96);
    imgBuffer.writeUInt32LE(24, slotOffset + 100);

    partitionsBuffer.copy(imgBuffer, slotOffset + 104);
    extentsBuffer.copy(imgBuffer, slotOffset + 104 + partitions.length * 52);

    for (const pb of payloadBuffers) {
        pb.data.copy(imgBuffer, pb.offset);
    }

    return imgBuffer;
}

test('img-viewer should list logical partitions in super.img', async ({ page }) => {
    const ext4Path = path.resolve(__dirname, '../example/test_ext4.img');
    const erofsPath = path.resolve(__dirname, '../example/test_erofs.img');

    const ext4Buf = fs.readFileSync(ext4Path);
    const erofsBuf = fs.readFileSync(erofsPath);

    const superBuffer = createSuperImage([
        { name: 'system_a', data: ext4Buf },
        { name: 'vendor_a', data: erofsBuf }
    ]);

    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: superBuffer,
            name: 'super.img',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.getByText('Android super.img Explorer')).toBeVisible();
    await expect(iframe.getByText('system_a')).toBeVisible();
    await expect(iframe.getByText('vendor_a')).toBeVisible();

    await iframe.getByText('system_a').click();
    await expect(iframe.getByText('hello.txt')).toBeVisible();
});

test('img-viewer should unpack attached super.img', async ({ page }) => {
    const attachedSuperPath = fs.existsSync('/tmp/file_attachments/super.img')
        ? '/tmp/file_attachments/super.img'
        : path.resolve(__dirname, '../example/attached_super.img');

    const attachedBuf = fs.readFileSync(attachedSuperPath);

    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: attachedBuf,
            name: 'super.img',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.getByText('Android super.img Explorer')).toBeVisible();
    await expect(iframe.getByText('system_a')).toBeVisible();
});

test('img-viewer should allow downloading and opening individual partitions from super.img', async ({ page }) => {
    const ext4Path = path.resolve(__dirname, '../example/test_ext4.img');
    const erofsPath = path.resolve(__dirname, '../example/test_erofs.img');

    const ext4Buf = fs.readFileSync(ext4Path);
    const erofsBuf = fs.readFileSync(erofsPath);

    const superBuffer = createSuperImage([
        { name: 'system_a', data: ext4Buf },
        { name: 'vendor_a', data: erofsBuf }
    ]);

    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: superBuffer,
            name: 'super.img',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.getByText('Android super.img Explorer')).toBeVisible();

    // Verify action buttons exist on partition row (system_a)
    const systemRow = iframe.locator('.column-item').filter({ hasText: 'system_a' });
    await expect(systemRow).toBeVisible();

    const openBtn = systemRow.locator('button[title="Open"]');
    const downloadBtn = systemRow.locator('button[title="Download"]');

    await expect(openBtn).toBeVisible();
    await expect(downloadBtn).toBeVisible();

    // Test download action for partition
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadBtn.click()
    ]);

    expect(download.suggestedFilename()).toBe('system_a.img');

    // Test open action for partition
    const openMessagePromise = page.evaluate(() => {
        return new Promise<any>((resolve) => {
            const listener = (e: MessageEvent) => {
                if (e.data && e.data.action === 'openFile') {
                    window.removeEventListener('message', listener);
                    resolve({ name: e.data.file.name, size: e.data.file.size });
                }
            };
            window.addEventListener('message', listener);
        });
    });

    await openBtn.click();
    const openMessage = await openMessagePromise;
    expect(openMessage.name).toBe('system_a.img');
    expect(openMessage.size).toBe(ext4Buf.length);
});
