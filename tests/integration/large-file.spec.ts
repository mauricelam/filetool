import { test, expect } from '@playwright/test';

test.describe('Large File Handling', () => {
    test('should load and render a 1.5GB file in Hex Viewer', async ({ page }) => {
        test.setTimeout(60000);

        await page.goto('/filetool/');
        const dropTarget = page.locator('#droptarget');
        await expect(dropTarget).toBeVisible();

        // Dispatch 1.5GB File (1500 chunks of 1MB)
        await page.evaluate(() => {
            const chunk = new Uint8Array(1024 * 1024);
            chunk.fill(65); // 'A'
            const chunks = new Array(1500).fill(chunk);
            const file = new File(chunks, 'large_1.5gb.txt', { type: 'text/plain' });
            window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
        });

        await expect(page.locator('.filename')).toHaveText('large_1.5gb.txt');

        const handlerButton = page.locator('.buttonBar button').first();
        await expect(handlerButton).toBeVisible();
        await handlerButton.click();

        const iframeLocator = page.locator('#framecontainer iframe');
        await expect(iframeLocator).toBeVisible({ timeout: 10000 });

        const iframe = page.frameLocator('#framecontainer iframe');
        await expect(iframe.locator('body')).toBeVisible();

        // Check large file warning and hex preview
        await expect(iframe.locator('body')).toContainText('Large file');
        await expect(iframe.locator('body')).toContainText('41 41 41 41');
    });

    test('should handle a 5GB file gracefully without unhandled crash', async ({ page }) => {
        test.setTimeout(60000);

        await page.goto('/filetool/');
        const dropTarget = page.locator('#droptarget');
        await expect(dropTarget).toBeVisible();

        // Dispatch 5GB File (5000 chunks of 1MB)
        await page.evaluate(() => {
            const chunk = new Uint8Array(1024 * 1024);
            chunk.fill(65);
            const chunks = new Array(5000).fill(chunk);
            const file = new File(chunks, 'large_5gb.txt', { type: 'text/plain' });
            window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
        });

        await expect(page.locator('.filename')).toHaveText('large_5gb.txt');

        const handlerButton = page.locator('.buttonBar button').first();
        await expect(handlerButton).toBeVisible();
        await handlerButton.click();

        const iframeLocator = page.locator('#framecontainer iframe');
        await expect(iframeLocator).toBeVisible({ timeout: 10000 });

        const iframe = page.frameLocator('#framecontainer iframe');
        await expect(iframe.locator('body')).toBeVisible();
    });
});
