import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

test('img-viewer should show a helpful error for NTFS .img files', async ({ page }) => {
    // NTFS magic "NTFS    " at offset 3
    const fileBuffer = Buffer.alloc(1024);
    fileBuffer.write("NTFS    ", 3);

    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: fileBuffer,
            name: 'test.img',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.getByText('Error Loading Image')).toBeVisible();
    await expect(iframe.getByText('.img file with type NTFS is not supported yet. Try an ext4 formatted img file instead')).toBeVisible();
});

test('img-viewer should show a helpful error for FAT32 .img files', async ({ page }) => {
    // FAT32 magic "FAT32   " at offset 0x52 (82)
    const fileBuffer = Buffer.alloc(1024);
    fileBuffer.write("FAT32   ", 82);

    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: fileBuffer,
            name: 'test.img',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.getByText('Error Loading Image')).toBeVisible();
    await expect(iframe.getByText('.img file with type FAT32 is not supported yet. Try an ext4 formatted img file instead')).toBeVisible();
});

test('img-viewer should show generic error for unknown .img files', async ({ page }) => {
    const fileBuffer = Buffer.from('this is just some random data that is not a known filesystem');

    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: fileBuffer,
            name: 'test.img',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.getByText('Error Loading Image')).toBeVisible();
    await expect(iframe.getByText('This file does not appear to be a valid ext4 filesystem image.')).toBeVisible();
});
