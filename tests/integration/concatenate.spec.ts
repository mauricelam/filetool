import { test, expect } from '@playwright/test';

test('should correctly concatenate multiple files and open it', async ({ page }) => {
    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible({ timeout: 30000 });

    // Dispatch the 'openFiles' event with multiple mock File objects
    await page.evaluate(() => {
        const file1 = new File(['Hello '], 'file1.txt', { type: 'text/plain' });
        const file2 = new File(['World!'], 'file2.txt', { type: 'text/plain' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file1, file2] }));
    });

    // Check that files are in the list
    await expect(page.locator('.file-list-item', { hasText: 'file1.txt' })).toBeVisible();
    await expect(page.locator('.file-list-item', { hasText: 'file2.txt' })).toBeVisible();

    // Select both files using Shift click for multi-selection
    await page.locator('.file-list-item', { hasText: 'file1.txt' }).click();
    await page.keyboard.down('Shift');
    await page.locator('.file-list-item', { hasText: 'file2.txt' }).click();
    await page.keyboard.up('Shift');

    // Click "Group selected"
    const groupButton = page.locator('button', { hasText: 'Group selected' });
    await expect(groupButton).toBeVisible();
    await groupButton.click();

    // Now the group should be selected and "Concatenate" should be visible in promoted handlers
    const concatButton = page.locator('button', { hasText: 'Concatenate' });
    await expect(concatButton).toBeVisible();
    await concatButton.click();

    // Check if the iframe is created and contains the concatenate view
    const iframe = page.frameLocator('iframe[data-handler="concatenate"]');

    await expect(iframe.getByText(/Concatenate Files/)).toBeVisible({ timeout: 15000 });
    await expect(iframe.getByText(/file1\.txt/)).toBeVisible();
    await expect(iframe.getByText(/file2\.txt/)).toBeVisible();

    // Check for the "Concatenate and Open" button
    const openButton = iframe.locator('button', { hasText: 'Concatenate and Open' });
    await expect(openButton).toBeVisible();

    // Set a custom filename
    const filenameInput = iframe.locator('input[type="text"]');
    await filenameInput.fill('output.bin');

    // Click "Concatenate and Open"
    await openButton.click();

    // Verify the new file is opened in the sidebar
    await expect(page.locator('.file-list-item', { hasText: 'output.bin' })).toBeVisible({ timeout: 15000 });
});
