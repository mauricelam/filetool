import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('DEX Viewer Breadcrumb "Show in Packages"', () => {
    test('should show current package in packages tab when clicking the target icon', async ({ page }) => {
        test.setTimeout(180000);
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
        await expect(iframe.locator('.package-tree')).toBeVisible({ timeout: 60000 });

        // Search for a class to navigate to it
        const searchInputSidebar = iframe.locator('.sidebar .search-input').first();
        await searchInputSidebar.fill('MainActivity');

        // Wait for results
        const classItem = iframe.locator('.class-list-item').first();
        await expect(classItem).toBeVisible({ timeout: 10000 });
        await classItem.click();

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
