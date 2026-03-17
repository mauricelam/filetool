import { test, expect } from '@playwright/test';

test('should show Hex viewer in the "open with" bar if no specific handlers match', async ({ page }) => {
    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible();

    // Dispatch the 'openFiles' event with a mock File object that has no specific handler
    // Using a random extension and type that shouldn't match anything specific
    await page.evaluate(() => {
        const file = new File(['\x00\x01\x02\x03'], 'unknown.xyz', { type: 'application/octet-stream' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    });

    // Check that the file is displayed
    await expect(page.locator('.filename')).toHaveText('unknown.xyz');

    // Check that the "Hex" button is visible in the button bar
    // The buttons are inside .buttonBar
    const hexButton = page.locator('.buttonBar button', { hasText: 'Hex' });

    // This is expected to FAIL before the fix if it's not showing up
    await expect(hexButton).toBeVisible();
});

test('should NOT show Hex viewer in the "open with" bar by default if specific handlers match', async ({ page }) => {
    await page.goto('/filetool/');

    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible();

    await page.evaluate(() => {
        const file = new File(['# Hello'], 'test.md', { type: 'text/markdown' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    });

    await expect(page.locator('.filename')).toHaveText('test.md');

    // "markdown" should be visible
    const markdownButton = page.locator('.buttonBar button', { hasText: 'markdown' });
    await expect(markdownButton).toBeVisible();

    // "Hex" should NOT be visible by default for a markdown file
    const hexButton = page.locator('.buttonBar button', { hasText: 'Hex' });
    await expect(hexButton).not.toBeVisible();
});
