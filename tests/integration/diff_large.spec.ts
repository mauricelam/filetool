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

    // Select both files and group
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await page.locator('.file-list-item', { hasText: 'large1.dat' }).click();
    await page.locator('.file-list-item', { hasText: 'large2.dat' }).click();
    await page.keyboard.up(modifier);
    await page.locator('button', { hasText: 'Group selected' }).click();

    // Open Diff Viewer
    await page.locator('button', { hasText: 'Diff Viewer' }).click();

    // Inside iframe
    const iframe = page.frameLocator('iframe[data-handler="diffviewer"]');

    // Check for the large file warning
    await expect(iframe.getByText('Files are too large for binary diffing (max 10MB).')).toBeVisible({ timeout: 15000 });
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

    // Select both files and group
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await page.locator('.file-list-item', { hasText: 'extreme1.dat' }).click();
    await page.locator('.file-list-item', { hasText: 'extreme2.dat' }).click();
    await page.keyboard.up(modifier);
    await page.locator('button', { hasText: 'Group selected' }).click();

    // Open Diff Viewer
    await page.locator('button', { hasText: 'Diff Viewer' }).click();

    // Inside iframe
    const iframe = page.frameLocator('iframe[data-handler="diffviewer"]');

    // Check for the extremely large file warning
    await expect(iframe.getByText('Files are too large for binary diffing (max 10MB).')).toBeVisible({ timeout: 15000 });
});
