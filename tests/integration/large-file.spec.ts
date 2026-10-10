import { test, expect } from '@playwright/test';

test('should handle a 5GB file without NotReadableError or memory crash', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible();

    // Dispatch the 'openFiles' event with a 5GB File object
    await page.evaluate(() => {
        const chunk = new Uint8Array(1024 * 1024);
        chunk.fill(65); // 'A'
        // 5000 chunks of 1MB = 5,242,880,000 bytes (5GB)
        const chunks = new Array(5000).fill(chunk);
        const file = new File(chunks, 'large_5gb.txt', { type: 'text/plain' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    });

    // Check that the filename is displayed in the file list
    await expect(page.locator('.filename')).toHaveText('large_5gb.txt');

    // Click "Hex" or "Text Viewer" button (whichever handler is promoted)
    const handlerButton = page.locator('.buttonBar button').first();
    await expect(handlerButton).toBeVisible();
    await handlerButton.click();

    // Check that the iframe is created and loaded for the active handler
    const iframeLocator = page.locator('#framecontainer iframe');
    await expect(iframeLocator).toBeVisible({ timeout: 10000 });

    const iframe = page.frameLocator('#framecontainer iframe');
    await expect(iframe.locator('body')).toBeVisible();
});
