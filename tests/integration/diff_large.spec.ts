import { test, expect } from '@playwright/test';

test('should show warning for large binary files', async ({ page }) => {
    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible({ timeout: 30000 });

    // Dispatch the 'openFiles' event with two large binary File objects (11MB)
    await page.evaluate(() => {
        const size = 11 * 1024 * 1024;
        const buf1 = new Uint8Array(size);
        const buf2 = new Uint8Array(size);
        buf1[0] = 0; // Trigger binary
        buf2[0] = 0;

        const file1 = new File([buf1], 'large1.dat', { type: 'application/octet-stream' });
        const file2 = new File([buf2], 'large2.dat', { type: 'application/octet-stream' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file1, file2] }));
    });

    // Check that files are in the list
    const item1 = page.locator('.file-list-item', { hasText: 'large1.dat' });
    const item2 = page.locator('.file-list-item', { hasText: 'large2.dat' });
    await expect(item1).toBeVisible({ timeout: 10000 });
    await expect(item2).toBeVisible({ timeout: 10000 });

    // Select both files using Keyboard modifiers
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    await page.keyboard.down(modifier);
    await item1.click();
    await item2.click();
    await page.keyboard.up(modifier);

    const groupButton = page.locator('button', { hasText: 'Group selected' });
    await expect(groupButton).toBeVisible({ timeout: 10000 });
    await groupButton.click();

    // Open Diff Viewer
    const diffButton = page.locator('button', { hasText: 'Diff' });
    await expect(diffButton).toBeVisible({ timeout: 10000 });
    await diffButton.click();

    // Inside iframe
    const iframe = page.frameLocator('iframe[data-handler="diffviewer"]');

    // Check for the large file warning
    await expect(iframe.getByText('Files are too large for binary diffing (max 10MB).')).toBeVisible({ timeout: 20000 });
});

test('should show warning for extremely large binary files', async ({ page }) => {
    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible({ timeout: 30000 });

    // Dispatch the 'openFiles' event with two extremely large binary File objects (11MB)
    await page.evaluate(() => {
        const size = 11 * 1024 * 1024;
        const buf1 = new Uint8Array(size);
        const buf2 = new Uint8Array(size);
        buf1[0] = 0; // Trigger binary
        buf2[0] = 0;

        const file1 = new File([buf1], 'extreme1.dat', { type: 'application/octet-stream' });
        const file2 = new File([buf2], 'extreme2.dat', { type: 'application/octet-stream' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file1, file2] }));
    });

    // Check that files are in the list
    const item1 = page.locator('.file-list-item', { hasText: 'extreme1.dat' });
    const item2 = page.locator('.file-list-item', { hasText: 'extreme2.dat' });
    await expect(item1).toBeVisible({ timeout: 10000 });
    await expect(item2).toBeVisible({ timeout: 10000 });

    // Select both files and group
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    await page.keyboard.down(modifier);
    await item1.click();
    await item2.click();
    await page.keyboard.up(modifier);

    const groupButton = page.locator('button', { hasText: 'Group selected' });
    await expect(groupButton).toBeVisible({ timeout: 10000 });
    await groupButton.click();

    // Open Diff Viewer
    const diffButton = page.locator('button', { hasText: 'Diff' });
    await expect(diffButton).toBeVisible({ timeout: 10000 });
    await diffButton.click();

    // Inside iframe
    const iframe = page.frameLocator('iframe[data-handler="diffviewer"]');

    // Check for the extremely large file warning
    await expect(iframe.getByText('Files are too large for binary diffing (max 10MB).')).toBeVisible({ timeout: 20000 });
});
