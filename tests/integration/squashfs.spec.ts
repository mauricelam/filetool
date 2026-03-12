import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('SquashFS Viewer should display image contents', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../../squashfs/example/example.squashfs');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'squashfs',
        file: {
            content: fileContent,
            name: 'example.squashfs',
            type: 'application/x-squashfs'
        }
    });

    // 1. Verify "SquashFS Image Explorer" header is visible
    await expect(iframe.locator('h2:has-text("SquashFS Image Explorer")')).toBeVisible({ timeout: 30000 });

    // 2. Verify the file tree contains expected entries
    await expect(iframe.locator('.item-name >> text="hello.txt"')).toBeVisible();
    await expect(iframe.locator('.item-name >> text="dir1"')).toBeVisible();

    // 3. Click on dir1 and verify nested contents
    await iframe.locator('.item-name >> text="dir1"').click();
    await expect(iframe.locator('.item-name >> text="nested.txt"')).toBeVisible();

    // 4. Click on hello.txt and verify preview
    await iframe.locator('.item-name >> text="hello.txt"').click();
    await expect(iframe.locator('h3:has-text("File Details")')).toBeVisible();
    await expect(iframe.locator('td:has-text("hello.txt")')).toBeVisible();
});
