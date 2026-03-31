import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('HPROF viewer verification', async ({ page }) => {
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
    // Wait for Sankey to be visible
    const sankeySvg = iframe.locator('.sankey-svg');
    await expect(sankeySvg).toBeVisible({ timeout: 100000 });

    // Hover over the first rect (GC Root)
    await sankeySvg.locator('rect').first().hover();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/hprof_hover_node.png' });

    // Hover over the first ribbon (path)
    await sankeySvg.locator('path').first().hover();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/hprof_hover_ribbon.png' });

    // Change split count
    const splitInput = iframe.locator('input[aria-label="Split count"]');
    await splitInput.fill('5');
    await splitInput.press('Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/hprof_split_count_5.png' });

    // Switch to Sunburst and check hover
    await iframe.getByRole('textbox', { name: 'Visualization type' }).click();
    await page.getByRole('option', { name: 'Sunburst' }).click();
    await page.waitForTimeout(2000);
    await iframe.locator('.sunburst-svg path').nth(5).hover();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/hprof_sunburst_hover.png' });
});
