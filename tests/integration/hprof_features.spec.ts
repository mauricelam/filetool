import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('HPROF viewer should display Sankey diagram with cycles and new features', async ({ page }) => {
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

    // Wait for the loading to complete
    await expect(iframe.locator('h2')).toContainText('HPROF Viewer: android.hprof', { timeout: 30000 });

    // Switch to Memory Flow tab
    await iframe.getByRole('tab', { name: 'Memory Flow' }).click();

    // Select Sankey
    const select = iframe.getByRole('textbox', { name: 'Visualization type' });
    await expect(select).toHaveValue('Sankey');

    // Wait for loading to finish
    await expect(iframe.locator('text=Analyzing heap dump...')).not.toBeVisible({ timeout: 60000 });

    // Check if Sankey SVG is visible and has content
    const sankeySvg = iframe.locator('.sankey-svg');
    await expect(sankeySvg).toBeVisible({ timeout: 60000 });

    // Change split count
    const splitInput = iframe.getByLabel('Split count');
    await splitInput.fill('5');
    await splitInput.press('Enter');
    await page.waitForTimeout(2000);

    // Hover over a node and check tooltip
    const firstNode = sankeySvg.locator('rect').first();
    await firstNode.hover();
    await page.waitForTimeout(1000);

    // Check if centralized tooltip is visible (it's in the iframe)
    const tooltip = iframe.locator('div:has-text("Retained:")').first();
    await expect(tooltip).toBeVisible();

    // Click a node to zoom
    await firstNode.click();
    await page.waitForTimeout(2000);

    // Check for breadcrumbs
    const breadcrumbs = iframe.locator('.mantine-Breadcrumbs-root');
    await expect(breadcrumbs).toBeVisible();

    // Switch to Sunburst
    await select.click();
    await iframe.getByRole('option', { name: 'Sunburst' }).click();
    await page.waitForTimeout(2000);
    await expect(iframe.locator('.sunburst-svg')).toBeVisible();

    // Take a screenshot
    await page.screenshot({ path: '/home/jules/verification/screenshots/hprof-sankey-features.png' });
});
