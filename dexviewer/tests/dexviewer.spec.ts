import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

test.describe('DEX Viewer Search', () => {
    test('should search for API usages and navigate to results in sidebar', async ({ page }) => {
        test.setTimeout(180000);
        const dexPath = path.join(__dirname, '..', '..', 'dexviewer', 'dex-parser', 'resources', 'classes.dex');
        const fileContent = fs.readFileSync(dexPath);

        const iframe = await runHandlerTest(page, {
            handler: 'dexviewer',
            file: {
                content: fileContent,
                name: 'classes.dex',
                type: 'application/octet-stream'
            }
        });

        await expect(iframe.locator('.package-tree')).toBeVisible({ timeout: 60000 });

        // Switch to API Search tab
        await iframe.locator('.tab-button:has-text("API Search")').click();

        // Search is now in sidebar
        const searchInput = iframe.locator('.sidebar .search-input');
        await searchInput.fill('Object');
        await iframe.locator('.sidebar .search-button').click();

        const firstResult = iframe.locator('.usage-item').first();
        await expect(firstResult).toBeVisible({ timeout: 60000 });

        const resultCount = await iframe.locator('.usage-item').count();
        console.log(`Found ${resultCount} results for 'Object'`);
        expect(resultCount).toBeGreaterThan(0);

        await firstResult.click();

        // Target method should be expanded
        await expect(iframe.locator('.method.expanded')).toBeVisible({ timeout: 30000 });
    });
});
