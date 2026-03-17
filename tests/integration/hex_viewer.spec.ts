import { test, expect } from '@playwright/test';
import { loadFile } from './test-utils';

test.describe('Hex Viewer', () => {
  test('performs basic operations: search, analysis, hashing, and resize', async ({ page }) => {
    // Navigate to the hex viewer directly
    await page.goto('./hex_viewer/index.html');

    // Load a dummy file
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;

    await page.evaluate((buf) => {
        const file = new File([new Uint8Array(buf)], 'test.bin');
        window.postMessage({ action: 'respondFile', file }, '*');
    }, Array.from(data));

    // Wait for UI to render
    await expect(page.locator('.tab-header')).toBeVisible();

    // 1. Search
    await page.click('button[title="Search"]');
    await page.fill('input[placeholder="Search query..."]', '0A 0B 0C');
    await page.click('button:has-text("Find")');

    // Check highlighting in hex view
    await expect(page.locator('.search-match').first()).toBeVisible();
    // Check preview
    await expect(page.locator('.match-preview')).toBeVisible();
    await expect(page.locator('.match-highlight').first()).toHaveText('0A');

    // 2. Analysis
    await page.click('button[title="Analysis"]');
    await expect(page.locator('canvas').first()).toBeVisible();

    // Click on canvas to jump
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    // (Assuming jump works if it doesn't crash the view)
    await expect(page.locator('#hexviewer')).toBeVisible();

    // 3. Hashing
    await page.click('button[title="Inspector"]');
    // Hashing should start automatically
    // SHA-256 should eventually appear
    await expect(page.locator('.inspector-row:has(span:has-text("SHA-256"))')).toBeVisible({ timeout: 10000 });
    const shaValue = page.locator('.inspector-row:has(span:has-text("SHA-256")) .inspector-value');
    await expect(shaValue).not.toHaveText('');

    // 4. Resize
    const initialBox = await page.locator('#inspector-container').boundingBox();
    const handle = page.locator('#resize-handle');

    const handleBox = await handle.boundingBox();
    if (handleBox && initialBox) {
        // Click near the top of the handle to avoid the toggle button (which is centered)
        const startX = handleBox.x + handleBox.width / 2;
        const startY = 10;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Move mouse to the left to INCREASE sidebar width (since sidebar is on the right)
        await page.mouse.move(startX - 100, startY, { steps: 10 });
        await page.mouse.up();

        const finalBox = await page.locator('#inspector-container').boundingBox();
        expect(finalBox?.width).toBeGreaterThan(initialBox.width);
    }

    // 5. Collapse/Expand Sidebar
    await page.click('.sidebar-toggle');
    await expect(page.locator('#inspector-container')).not.toBeVisible();
    await expect(page.locator('#resize-handle')).not.toBeVisible();

    await page.click('.sidebar-toggle');
    await expect(page.locator('#inspector-container')).toBeVisible();
    await expect(page.locator('#resize-handle')).toBeVisible();
  });
});
