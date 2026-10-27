import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test.describe('Archive Viewer File Search', () => {
    test.slow();

    test('should allow searching file names and file types in archive tree explorer', async ({ page }) => {
        const filePath = path.join(__dirname, '../../node_modules/@mauricelam/ghidra-decompiler-wasm/dist/Processors/JVM/lib/JVM-src.zip');
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

        // Locate search input
        const searchInput = iframe.getByTestId('column-search-input');
        await expect(searchInput).toBeVisible();

        // 1. Search by filename substring (e.g. "JavaLoader")
        await searchInput.fill('JavaLoader');

        const resultList = iframe.getByTestId('search-results-list');
        await expect(resultList).toBeVisible();

        const resultCount = iframe.getByTestId('column-search-count');
        await expect(resultCount).toBeVisible();
        await expect(resultCount).not.toHaveText('0 results');

        // Check search result items
        const results = resultList.locator('.search-result-item');
        await expect(results.first()).toBeVisible();
        await expect(results.first()).toContainText('JavaLoader.java');

        // Click a search result to select it
        await results.first().click();
        await expect(results.first()).toHaveClass(/selected/);

        // Clear search input using clear button
        const clearBtn = iframe.getByTestId('column-search-clear');
        await expect(clearBtn).toBeVisible();
        await clearBtn.click();

        // Verify result list is hidden and column view returns
        await expect(resultList).not.toBeVisible();

        // 2. Search by extension/type (e.g. ".java" or "java")
        await searchInput.fill('.java');
        await expect(resultList).toBeVisible();
        await expect(resultCount).not.toHaveText('0 results');
        await expect(results.first()).toContainText('.java');

        // Clear search input by clearing input text
        await searchInput.fill('');
        await expect(resultList).not.toBeVisible();
    });

    test('should allow resizing columns horizontally even when preview pane is visible', async ({ page }) => {
        const filePath = path.join(__dirname, '../../node_modules/@mauricelam/ghidra-decompiler-wasm/dist/Processors/JVM/lib/JVM-src.zip');
        const fileBuffer = fs.readFileSync(filePath);
        const iframe = await runHandlerTest(page, {
            handler: 'archive',
            file: {
                content: Uint8Array.from(fileBuffer),
                name: 'JVM-src.zip',
                type: 'application/zip'
            },
        });

        await expect(iframe.getByText('Archive Contents', { exact: false })).toBeVisible({ timeout: 10000 });

        // Search for a file and select it to display preview pane
        const searchInput = iframe.getByTestId('column-search-input');
        await searchInput.fill('JavaLoader');

        const resultList = iframe.getByTestId('search-results-list');
        await expect(resultList).toBeVisible();

        const results = resultList.locator('.search-result-item');
        await expect(results.first()).toBeVisible();
        await results.first().click();

        // Verify preview pane is visible
        const previewPane = iframe.locator('.preview-pane');
        await expect(previewPane).toBeVisible();

        // Find search resizer
        const resizer = iframe.getByTestId('search-resizer');
        await expect(resizer).toBeVisible();

        const initialBox = await resultList.boundingBox();
        if (!initialBox) throw new Error('Could not get initial search results box');

        const resizerBox = await resizer.boundingBox();
        if (!resizerBox) throw new Error('Could not get resizer box');

        // Drag resizer into preview pane area by 150px
        const startX = resizerBox.x + resizerBox.width / 2;
        const startY = resizerBox.y + 100;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 150, startY, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(300);

        const newBox = await resultList.boundingBox();
        if (!newBox) throw new Error('Could not get updated search results box');

        expect(newBox.width).toBeGreaterThan(initialBox.width + 80);
    });
});
