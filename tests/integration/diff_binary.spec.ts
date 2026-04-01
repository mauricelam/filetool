import { test, expect } from '@playwright/test';

test('should correctly show binary diff between two binary files', async ({ page }) => {
    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible({ timeout: 30000 });

    // Dispatch the 'openFiles' event with multiple mock binary File objects
    await page.evaluate(() => {
        // Create binary buffers with null bytes to trigger binary mode
        const buf1 = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
        const buf2 = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x42, 0x69, 0x6e, 0x61, 0x72, 0x79]);

        const file1 = new File([buf1], 'bin1.dat', { type: 'application/octet-stream' });
        const file2 = new File([buf2], 'bin2.dat', { type: 'application/octet-stream' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file1, file2] }));
    });

    // Check that files are in the list
    await expect(page.locator('.file-list-item', { hasText: 'bin1.dat' })).toBeVisible();
    await expect(page.locator('.file-list-item', { hasText: 'bin2.dat' })).toBeVisible();

    // Select both files using Ctrl/Cmd click
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await page.locator('.file-list-item', { hasText: 'bin1.dat' }).click();
    await page.locator('.file-list-item', { hasText: 'bin2.dat' }).click();
    await page.keyboard.up(modifier);

    // Click "Group selected"
    const groupButton = page.locator('button', { hasText: 'Group selected' });
    await expect(groupButton).toBeVisible();
    await groupButton.click();

    // Open Diff Viewer
    const diffViewerButton = page.locator('button', { hasText: 'Diff Viewer' });
    await expect(diffViewerButton).toBeVisible();
    await diffViewerButton.click();

    // Check if the iframe is created and contains the diff
    const iframe = page.frameLocator('iframe[data-handler="diffviewer"]');
    await expect(iframe.getByText(/Diffing: bin1\.dat vs bin2\.dat/)).toBeVisible({ timeout: 15000 });

    // Verify binary mode is active (Binary button should have active style)
    const binaryButton = iframe.getByRole('button', { name: 'Binary' });
    await expect(binaryButton).toHaveCSS('background-color', 'rgb(102, 102, 102)'); // #666

    // Check for hex offsets (e.g., 00000000)
    await expect(iframe.getByText('00000000').first()).toBeVisible();

    // Check for some diff content (hex values)
    // 'World' is [57, 6f, 72, 6c, 64]
    // 'Binary' is [42, 69, 6e, 61, 72, 79]
    await expect(iframe.locator('span', { hasText: '57' })).toBeVisible(); // W
    await expect(iframe.locator('span', { hasText: '42' })).toBeVisible(); // B
});
