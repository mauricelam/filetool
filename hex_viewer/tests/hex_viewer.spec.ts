import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

test.describe('Hex Viewer', () => {
  test('performs basic operations: search, analysis, hashing, and resize', async ({ page }) => {
    // Load a dummy file
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;

    const iframe = await runHandlerTest(page, {
        handler: 'hex_viewer',
        file: {
            content: data,
            name: 'test.bin',
            type: 'application/octet-stream'
        }
    });

    // Wait for UI to render
    await expect(iframe.locator('.tab-header')).toBeVisible();

    // 1. Search
    await iframe.click('button[title="Search"]');
    await iframe.fill('input[placeholder="Search query..."]', '0A 0B 0C');
    await iframe.click('button:has-text("Find")');

    // Check highlighting in hex view
    await expect(iframe.locator('.search-match').first()).toBeVisible();
    // Check preview
    await expect(iframe.locator('.match-preview')).toBeVisible();
    await expect(iframe.locator('.match-highlight').first()).toHaveText('0A');

    // 2. Analysis
    await iframe.click('button[title="Analysis"]');
    await expect(iframe.locator('canvas').first()).toBeVisible();

    // Click on canvas to jump
    const canvas = iframe.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    // (Assuming jump works if it doesn't crash the view)
    await expect(iframe.locator('#hexviewer')).toBeVisible();

    // 3. Hashing
    await iframe.click('button[title="Inspector"]');
    // Hashing should start automatically
    // SHA-256 should eventually appear
    await expect(iframe.locator('.inspector-row:has(span:has-text("SHA-256"))')).toBeVisible({ timeout: 10000 });
    const shaValue = iframe.locator('.inspector-row:has(span:has-text("SHA-256")) .inspector-value');
    await expect(shaValue).not.toHaveText('');

    // 4. Resize
    const initialBox = await iframe.locator('#inspector-container').boundingBox();
    const handle = iframe.locator('#resize-handle');

    const handleBox = await handle.boundingBox();
    if (handleBox && initialBox) {
        // Click near the top of the handle to avoid the toggle button (which is centered)
        const startX = handleBox.x + handleBox.width / 2;
        const startY = handleBox.y + 10; // offset relative to the page
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Move mouse to the left to INCREASE sidebar width (since sidebar is on the right)
        await page.mouse.move(startX - 100, startY, { steps: 10 });
        await page.mouse.up();

        const finalBox = await iframe.locator('#inspector-container').boundingBox();
        expect(finalBox?.width).toBeGreaterThan(initialBox.width);
    }

    // 5. Collapse/Expand Sidebar
    await iframe.click('.sidebar-toggle');
    await expect(iframe.locator('#inspector-container')).not.toBeVisible();
    await expect(iframe.locator('#resize-handle')).not.toBeVisible();

    await iframe.click('.sidebar-toggle');
    await expect(iframe.locator('#inspector-container')).toBeVisible();
    await expect(iframe.locator('#resize-handle')).toBeVisible();
  });
});
