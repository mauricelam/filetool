import { test, expect } from '@playwright/test';

test('should correctly handle a folder drop', async ({ page }) => {
    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible();

    // Dispatch the 'openFiles' event with multiple mock File objects
    await page.evaluate(() => {
        const files = [
            new File(['file content 1'], 'test1.txt', { type: 'text/plain' }),
            new File(['file content 2'], 'test2.txt', { type: 'text/plain' }),
            new File(['file content 3'], 'test3.txt', { type: 'text/plain' }),
        ];
        window.dispatchEvent(new CustomEvent('openFiles', { detail: files }));
    });

    // Check that all files are in the list
    await expect(page.locator('span', { hasText: 'test1.txt' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'test2.txt' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'test3.txt' })).toBeVisible();

    // Check that the last file is displayed
    await expect(page.locator('.filename')).toHaveCount(1);
    await expect(page.locator('.filename')).toHaveText('test3.txt');

    // Click the first file in the list
    await page.locator('span', { hasText: 'test1.txt' }).click();

    // Check that the first file is now displayed
    await expect(page.locator('.filename')).toHaveText('test1.txt');
});
