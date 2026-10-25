import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { test, expect } from '../../tests/fixtures.js';
import { runHandlerTest } from '@filetool/integration-test-harness';

test.describe('Archive Viewer File Search', () => {
    test.slow();

    test('should allow searching file names and file types in archive tree explorer', async ({ page }) => {
        const filePath = path.join(__dirname, '../../node_modules/@mauricelam/ghidra-decompiler-wasm/dist/Processors/JVM/lib/JVM-src.zip');
        const fileBuffer = fs.readFileSync(filePath);
        // skipOffline: true because WASM/worker (libarchive, wasmagic) is loaded lazily after receiving the file
        const iframe = await runHandlerTest(page, {
            handler: 'archive',
            file: {
                content: Uint8Array.from(fileBuffer),
                name: 'JVM-src.zip',
                type: 'application/zip'
            },
            skipOffline: true,
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
});
