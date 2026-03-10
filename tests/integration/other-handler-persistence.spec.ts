import { test, expect } from '@playwright/test';

test('other handler should persist in button bar and when switching files', async ({ page }) => {
    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible();

    // 1. Open first file
    await page.evaluate(() => {
        const file = new File(['file 1 content'], 'file1.bin', { type: 'application/octet-stream' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    });
    await expect(page.locator('.filename')).toHaveText('file1.bin');

    // 2. Select Hex from "Other"
    await page.getByTitle('Other handlers').click();
    const searchBox = page.getByPlaceholder('Filter by name, mime, or extension');
    await searchBox.fill('Hex');
    await searchBox.press('Enter');

    // Verify Hex is active (it's a universal handler, so it should be visible now)
    const hexButton = page.locator('.buttonBar button', { hasText: 'Hex' });
    await expect(hexButton).toBeVisible();
    // It should have the active style (0066cc background)
    await expect(hexButton).toHaveCSS('background-color', 'rgb(0, 102, 204)');

    // 3. Select CyberChef from "Other"
    await page.getByTitle('Other handlers').click();
    await searchBox.fill('CyberChef');
    await searchBox.press('Enter');

    // Verify both Hex and CyberChef are in the button bar
    const cyberChefButton = page.locator('.buttonBar button', { hasText: 'CyberChef' });
    await expect(cyberChefButton).toBeVisible();
    await expect(hexButton).toBeVisible();
    await expect(cyberChefButton).toHaveCSS('background-color', 'rgb(0, 102, 204)');

    // 4. Open second file
    await page.evaluate(() => {
        const file = new File(['file 2 content'], 'file2.txt', { type: 'text/plain' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    });
    await expect(page.locator('.filename')).toHaveText('file2.txt');
    // For a txt file, Text Viewer should be default/matched, CyberChef/Hex should NOT be there yet
    await expect(page.locator('.buttonBar button', { hasText: 'CyberChef' })).not.toBeVisible();

    // 5. Switch back to file1.bin
    await page.getByText('file1.bin').click();
    await expect(page.locator('.filename')).toHaveText('file1.bin');

    // Verify CyberChef is still active and both buttons are still there
    await expect(page.locator('.buttonBar button', { hasText: 'CyberChef' })).toBeVisible();
    await expect(page.locator('.buttonBar button', { hasText: 'Hex' })).toBeVisible();
    await expect(page.locator('.buttonBar button', { hasText: 'CyberChef' })).toHaveCSS('background-color', 'rgb(0, 102, 204)');
});
