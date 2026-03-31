import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('HPROF viewer Sankey diagram should have specific features', async ({ page }) => {
    test.setTimeout(120000);
    const filePath = path.resolve(__dirname, '../../hprof/example/android.hprof');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'hprof',
        file: {
            content: fileContent,
            name: 'android.hprof',
            type: ''
        }
    });

    await expect(iframe.locator('h2')).toContainText('HPROF Viewer: android.hprof', { timeout: 30000 });
    await iframe.getByRole('tab', { name: 'Memory Flow' }).click();

    // Ensure Sankey is selected
    const select = iframe.getByRole('textbox', { name: 'Visualization type' });
    await expect(select).toHaveValue('Sankey');

    const sankeySvg = iframe.locator('.sankey-svg');
    await expect(sankeySvg).toBeVisible({ timeout: 60000 });

    // Check for "Root GC" label and retained size
    const rootLabel = iframe.locator('.node-label').filter({ hasText: 'Root GC' });
    await expect(rootLabel).toBeVisible();
    await expect(rootLabel).toContainText(/MB|KB|B/);

    // Check for a link with a title containing percentage
    const firstPath = sankeySvg.locator('path').first();
    const title = await firstPath.locator('title').textContent();
    expect(title).toMatch(/\d+\.\d+% of parent/);

    // Click an "Others" node if it exists
    const othersNode = iframe.locator('rect').filter({ has: iframe.locator('title:has-text("Others")') });
    if (await othersNode.count() > 0) {
        await othersNode.first().click();
        // Wait for it to expand (it should re-render)
        await page.waitForTimeout(2000);
        // "Others" for that parent should ideally be gone or smaller
        // This is hard to assert without knowing the exact structure, but we check it doesn't crash
        await expect(sankeySvg).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/hprof-sankey-verified.png' });
});
