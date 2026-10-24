import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('Disk Image Viewer should open raw ext4 image and list directory contents', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../../img-viewer/example/test_ext4.img');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'disk-viewer',
        file: {
            content: fileContent,
            name: 'test_ext4.img',
            type: 'application/octet-stream'
        }
    });

    // 1. Verify "Disk Image Explorer" header is visible
    await expect(iframe.locator('h2:has-text("Disk Image Explorer")')).toBeVisible({ timeout: 30000 });

    // 2. Verify file entries in ext4 filesystem
    await expect(iframe.locator('.item-name >> text="hello.txt"')).toBeVisible({ timeout: 15000 });
    await expect(iframe.locator('.item-name >> text="lost+found"')).toBeVisible();

    // 3. Click on hello.txt and verify Item Details
    await iframe.locator('.item-name >> text="hello.txt"').click();
    await expect(iframe.locator('h3:has-text("Item Details")')).toBeVisible();
    await expect(iframe.locator('td:has-text("/hello.txt")')).toBeVisible();
});

test('Disk Image Viewer should expose fstool error when opening corrupt filesystem', async ({ page }) => {
    // 1024 bytes of zeroed data that cannot be parsed as a valid filesystem
    const invalidImage = new Uint8Array(1024);

    const iframe = await runHandlerTest(page, {
        handler: 'disk-viewer',
        file: {
            content: invalidImage,
            name: 'corrupt.img',
            type: 'application/octet-stream'
        }
    });

    // Verify error UI is displayed with fstool error message
    await expect(iframe.locator('h2:has-text("Disk Image Error")')).toBeVisible({ timeout: 30000 });
    await expect(iframe.locator('text=/Failed to open filesystem/i')).toBeVisible();
});
