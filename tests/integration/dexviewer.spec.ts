import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('DEX Viewer Search', () => {
    test('should search for API usages and navigate to results', async ({ page }) => {
        test.setTimeout(120000);
        const dexPath = path.join(__dirname, '..', '..', 'dexviewer', 'dex-parser', 'resources', 'classes.dex');

        const fileContent = fs.readFileSync(dexPath);
        const contentArray = Array.from(new Uint8Array(fileContent));

        await page.goto('http://localhost:8080/filetool/tests/integration/driver.html?handler=dexviewer');

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
        await expect(iframe.locator('.package-tree')).toBeVisible({ timeout: 30000 });

        await iframe.locator('button:has-text("API Usages")').click();

        // Search for a very generic term that must exist in any DEX instructions (like 'invoke' or 'return')
        const searchInput = iframe.locator('input[type="text"]');
        await searchInput.fill('return');
        await iframe.locator('button:has-text("Search")').click();

        const firstResult = iframe.locator('.usage-result').first();
        await expect(firstResult).toBeVisible({ timeout: 60000 });

        const resultCount = await iframe.locator('.usage-result').count();
        console.log(`Found ${resultCount} results for 'return'`);
        expect(resultCount).toBeGreaterThan(0);

        await firstResult.click();

        await expect(iframe.locator('button.active:has-text("Classes")')).toBeVisible({ timeout: 20000 });
        await expect(iframe.locator('.method.highlighted')).toBeVisible({ timeout: 20000 });
    });
});
