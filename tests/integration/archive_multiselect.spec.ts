
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { runHandlerTest } from './test-utils';

test.describe('Archive Viewer Multi-selection', () => {
    test.slow();

    test('should allow shift-selection and update download button', async ({ page }) => {
        const filePath = path.join(__dirname, '../../ghidra/ghidra-decompiler/Processors/JVM/lib/JVM-src.zip');
        const fileBuffer = fs.readFileSync(filePath);
        const iframe = await runHandlerTest(page, {
            handler: 'archive',
            file: {
                content: Uint8Array.from(fileBuffer),
                name: 'JVM-src.zip',
                type: 'application/zip'
            },
        });

        // Wait for the archive to load
        await expect(iframe.getByText('Archive Contents', { exact: false })).toBeVisible({ timeout: 10000 });

        // Find file items in the first column
        const firstColumn = iframe.locator('.columns-container > div').nth(0);
        const firstItem = firstColumn.locator('.column-item').nth(0);
        await expect(firstItem).toBeVisible();

        // Click the first item to expand it
        await firstItem.click();
        await expect(firstItem).toHaveClass(/selected/);

        // Find items in the second column
        const secondColumn = iframe.locator('.columns-container > div').nth(1);
        const secondColumnItems = secondColumn.locator('.column-item');
        await expect(secondColumnItems.nth(0)).toBeVisible();
        await expect(secondColumnItems.nth(1)).toBeVisible();

        // Click the first item in the second column
        await secondColumnItems.nth(0).click();
        await expect(secondColumnItems.nth(0)).toHaveClass(/selected/);

        // Shift-click the second item in the second column
        await secondColumnItems.nth(1).click({ modifiers: ['Shift'] });

        // Verify both items in the second column are selected
        await expect(secondColumnItems.nth(0)).toHaveClass(/selected/);
        await expect(secondColumnItems.nth(1)).toHaveClass(/selected/);

        // Verify the download button title/text changed
        const downloadBtn = iframe.locator('button[title*="Download"]');
        await expect(downloadBtn).toHaveAttribute('title', 'Download Selected');

        // Ensure regular click clears multi-selection
        await secondColumnItems.nth(0).click();
        await expect(secondColumnItems.nth(1)).not.toHaveClass(/selected/);
        await expect(secondColumnItems.nth(0)).toHaveClass(/selected/);
        await expect(downloadBtn).toHaveAttribute('title', 'Download');
    });
});
