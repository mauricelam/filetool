import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';

test('img-viewer should show a helpful error for non-ext4 files', async ({ page }) => {
    const fileBuffer = Buffer.from('this is not an ext4 image');
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
