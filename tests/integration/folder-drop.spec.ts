
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

    // Wait for the pager to show "3 / 3" since the last file is selected by default
    await expect(page.getByText('3 / 3')).toBeVisible();

    // Check that the last file is displayed
    await expect(page.locator('.filename')).toHaveCount(1);
    await expect(page.getByText('test3.txt')).toBeVisible();

    // Click the pager to navigate to the first file
    await page.getByText('◀').click();
    await page.getByText('◀').click();


    // Check that the first file is now displayed
    await expect(page.getByText('1 / 3')).toBeVisible();
    await expect(page.getByText('test1.txt')).toBeVisible();
});
