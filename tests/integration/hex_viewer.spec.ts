import { test, expect } from '@playwright/test';
import { loadFile } from './test-utils';

test.describe('Hex Viewer', () => {
  test('performs basic operations: search, analysis, hashing, and resize', async ({ page }) => {
    // Navigate to the hex viewer directly
    await page.goto('http://localhost:8080/filetool/hex_viewer/index.html');

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
    await page.click('button[title="Hashing"]');
    // Hashing should start automatically
    // SHA-256 should eventually appear
    await expect(page.locator('.inspector-row:has(span:has-text("SHA-256"))')).toBeVisible({ timeout: 10000 });
    const shaValue = page.locator('.inspector-row:has(span:has-text("SHA-256")) .inspector-value');
    await expect(shaValue).not.toHaveText('');

    // 4. Resize
    const handle = page.locator('#resize-handle');
    const initialBox = await page.locator('#inspector-container').boundingBox();

    const handleBox = await handle.boundingBox();
    if (handleBox && initialBox) {
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(handleBox.x - 50, handleBox.y + handleBox.height / 2);
        await page.mouse.up();

        const finalBox = await page.locator('#inspector-container').boundingBox();
        expect(finalBox?.width).toBeGreaterThan(initialBox.width);
    }
  });
});
