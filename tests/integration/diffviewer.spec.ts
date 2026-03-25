import { test, expect } from '@playwright/test';

test('should correctly show diff between two files', async ({ page }) => {
    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible({ timeout: 30000 });

    // Dispatch the 'openFiles' event with multiple mock File objects
    await page.evaluate(() => {
        const file1 = new File(['line 1\nline 2\nline 3'], 'file1.txt', { type: 'text/plain' });
        const file2 = new File(['line 1\nline 2 mod\nline 3\nline 4'], 'file2.txt', { type: 'text/plain' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file1, file2] }));
    });

    // Check that files are in the list
    await expect(page.locator('.file-list-item', { hasText: 'file1.txt' })).toBeVisible();
    await expect(page.locator('.file-list-item', { hasText: 'file2.txt' })).toBeVisible();

    // Select both files using Ctrl/Cmd click for both to ensure they are both in multi-selection
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await page.locator('.file-list-item', { hasText: 'file1.txt' }).click();
    await page.locator('.file-list-item', { hasText: 'file2.txt' }).click();
    await page.keyboard.up(modifier);

    // Click "Group selected"
    const groupButton = page.locator('button', { hasText: 'Group selected' });
    await expect(groupButton).toBeVisible();
    await groupButton.click();

    // Now the group should be selected and "Diff Viewer" should be visible in promoted handlers
    const diffViewerButton = page.locator('button', { hasText: 'Diff Viewer' });
    await expect(diffViewerButton).toBeVisible();
    await diffViewerButton.click();

    // Check if the iframe is created and contains the diff
    const iframe = page.frameLocator('iframe[data-handler="diffviewer"]');

    await expect(iframe.getByText('Diffing: file1.txt (left) vs file2.txt (right)')).toBeVisible({ timeout: 15000 });

    // Check for some diff content
    await expect(iframe.locator('.diff-code-deleted', { hasText: 'line 2' })).toBeVisible();
    await expect(iframe.locator('.diff-code-inserted', { hasText: 'line 2 mod' })).toBeVisible();
    await expect(iframe.locator('.diff-code-inserted', { hasText: 'line 4' })).toBeVisible();
});
