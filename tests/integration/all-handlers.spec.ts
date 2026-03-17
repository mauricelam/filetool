import { test, expect } from '@playwright/test';

test('should focus search box and select first match with Enter in All Handlers dialog', async ({ page }) => {
    await page.goto('./');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible();

    // Dispatch the 'openFiles' event with a mock File object
    await page.evaluate(() => {
        const file = new File(['file content'], 'test.txt', { type: 'text/plain' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    });

    // Check that the file is displayed
    await expect(page.locator('.filename')).toHaveText('test.txt');

    // Click "Other" to open the "All Handlers" dialog
    const otherButton = page.getByTitle('Other handlers');
    await otherButton.click();

    // Check that the search box is focused
    const searchBox = page.getByPlaceholder('Filter by name, mime, or extension');
    await expect(searchBox).toBeFocused();

    // Type "Hex" to filter
    await searchBox.fill('Hex');

    // Wait for the Hex button to be visible and selected
    const hexButton = page.locator('.handler-button.selected', { hasText: 'Hex' });
    await expect(hexButton).toBeVisible();

    // Press Enter to select the first match (Hex Viewer)
    await searchBox.press('Enter');

    // Check that the dialog is closed
    await expect(page.locator('.other-handlers-dialog')).not.toBeVisible();

    // Check that the Hex Viewer is opened
    // Use the title of the iframe which should be the filename
    const iframeLocator = page.locator('#framecontainer iframe');
    await expect(iframeLocator).toBeVisible({ timeout: 10000 });

    const iframe = page.frameLocator('#framecontainer iframe');

    // 'file' in hex is '66 69 6c 65' -> '66 69 6C 65' in our hex viewer
    await expect(iframe.locator('body')).toContainText('66 69 6C 65', { timeout: 15000 });
});
