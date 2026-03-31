import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('HPROF viewer should display Sunburst diagram', async ({ page }) => {
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

    // Switch to Sunburst tab
    await iframe.getByRole('tab', { name: 'Memory Flow (Sunburst)' }).click();

    // Check if Sunburst SVG is visible and has content
    const sunburstSvg = iframe.locator('.sunburst-svg');
    await expect(sunburstSvg).toBeVisible({ timeout: 30000 });

    // Check for some paths (arcs) in the SVG
    const pathCount = await sunburstSvg.locator('path').count();
    expect(pathCount).toBeGreaterThan(0);

    // Take a screenshot
    await page.screenshot({ path: 'test-results/hprof-sunburst.png' });
});
