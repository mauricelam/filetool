import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

test('HPROF viewer should display Sankey diagram', async ({ page }) => {
    test.setTimeout(120000);
    const filePath = path.resolve(__dirname, '../example/android.hprof');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'hprof',
        file: {
            content: fileContent,
            name: 'android.hprof',
            type: ''
        }
    });

    // Wait for the loading to complete
    await expect(iframe.locator('h2')).toContainText('HPROF Viewer: android.hprof', { timeout: 30000 });

    // Switch to Memory Flow tab
    await iframe.getByRole('tab', { name: 'Memory Flow' }).click();

    // Ensure Sankey is selected by default (or select it)
    const select = iframe.getByRole('textbox', { name: 'Visualization type' });
    await expect(select).toHaveValue('Sankey');

    // Wait for loading to finish
    await expect(iframe.locator('text=Analyzing heap dump...')).not.toBeVisible({ timeout: 60000 });

    // Check if Sankey SVG is visible and has content
    const sankeySvg = iframe.locator('.sankey-svg');
    await expect(sankeySvg).toBeVisible({ timeout: 60000 });

    // Check for some rects and paths in the SVG
    const rectCount = await sankeySvg.locator('rect').count();
    expect(rectCount).toBeGreaterThan(0);
    const pathCount = await sankeySvg.locator('path').count();
    expect(pathCount).toBeGreaterThan(0);

    // Take a screenshot
    await page.screenshot({ path: 'test-results/hprof-sankey.png' });
});
