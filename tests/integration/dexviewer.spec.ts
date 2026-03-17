import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('DEX Viewer Search', () => {
    test('should search for API usages and navigate to results in sidebar', async ({ page }) => {
        test.setTimeout(180000);
        const dexPath = path.join(__dirname, '..', '..', 'dexviewer', 'dex-parser', 'resources', 'classes.dex');

        const fileContent = fs.readFileSync(dexPath);
        const contentArray = Array.from(new Uint8Array(fileContent));

        await page.goto('http://localhost:8080./tests/integration/driver.html?handler=dexviewer');

        await page.evaluate(({ contentArray, name }) => {
            window.postMessage({
                action: 'setFile',
                file: {
                    content: new Uint8Array(contentArray),
                    name: name,
                    type: 'application/octet-stream'
                }
            }, '*');
        }, { contentArray, name: 'classes.dex' });

        const iframe = page.frameLocator('#file-handler-iframe');
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
