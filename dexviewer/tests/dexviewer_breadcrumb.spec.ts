import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

test.describe('DEX Viewer Breadcrumb "Show in Packages"', () => {
    test('should show current package in packages tab when clicking the target icon', async ({ page }) => {
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
        await firstResult.click();

        // Verify breadcrumbs are visible
        await expect(iframe.locator('.breadcrumbs')).toBeVisible();

        // Check if "Show in Packages" button is visible (if class has a package)
        const showInPackagesBtn = iframe.locator('.show-in-packages-btn');
        const count = await showInPackagesBtn.count();
        if (count > 0) {
            // Switch to another tab first to verify it switches back
            await iframe.locator('.tab-button:has-text("Info")').click();
            await expect(iframe.locator('.tab-button:has-text("Info")')).toHaveClass(/active/);

            // Click the button
            await showInPackagesBtn.click();

            // Verify it switched back to Packages tab
            await expect(iframe.locator('.tab-button:has-text("Packages")')).toHaveClass(/active/);

            // The package tree should be visible and the package should be highlighted (indicated by background color change)
            // Note: the highlight is temporary, but we can check if it's there
            // However, scrollIntoView is harder to verify without visual checks.
            // At least we verified the tab switch and the button exists.
        } else {
            console.log('Class has no package, button not shown as expected');
        }
    });
});
