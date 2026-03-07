import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';
import fs from 'fs';
import path from 'path';

test('img-viewer should list files in an ext4 image', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../../img-viewer/example/test_ext4.img');
    if (!fs.existsSync(filePath)) {
        throw new Error(`test_ext4.img fixture not found at ${filePath}`);
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
    await expect(iframe.getByText('ext4 Image Explorer')).toBeVisible();

    // Check for the hello.txt file we added to the image
    await expect(iframe.getByText('hello.txt')).toBeVisible();

    // Click on hello.txt and check preview
    await iframe.getByText('hello.txt').click();
    await expect(iframe.getByText('File Details')).toBeVisible();
    await expect(iframe.getByText('/hello.txt')).toBeVisible();
});
