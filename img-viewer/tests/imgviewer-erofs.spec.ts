import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('img-viewer should list files in an erofs image', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/test_erofs.img');
    if (!fs.existsSync(filePath)) {
        throw new Error(`test_erofs.img fixture not found at ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const iframe = await runHandlerTest(page, {
        handler: 'img-viewer',
        file: {
            content: fileBuffer,
            name: 'test.img',
            type: 'application/octet-stream'
        }
    });

    // Check if the explorer title is present
    await expect(iframe.getByText('EROFS Image Explorer')).toBeVisible();

    // Check for the hello.txt file in the image
    await expect(iframe.getByText('hello.txt')).toBeVisible();

    // Click on hello.txt and check preview
    await iframe.getByText('hello.txt').click();
    await expect(iframe.getByText('File Details')).toBeVisible();
    await expect(iframe.getByText('/hello.txt')).toBeVisible();
});
