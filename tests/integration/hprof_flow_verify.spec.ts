import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('HPROF memory flow features verification', async ({ page }) => {
    test.setTimeout(120000);
    const hprofPath = 'hprof/example/android.hprof';
    if (!fs.existsSync(hprofPath)) return;

    const iframe = await runHandlerTest(page, {
        handler: 'hprof',
        file: {
            name: 'android.hprof',
            content: fs.readFileSync(hprofPath),
            type: ''
        }
    });

    // Wait for the viewer to load
    await expect(iframe.locator('h2')).toContainText('HPROF Viewer: android.hprof', { timeout: 30000 });

    // Switch to Memory Flow tab
    await iframe.getByRole('tab', { name: 'Memory Flow' }).click();

    // Verify Breadcrumbs - initial state
    await expect(iframe.locator('.mantine-Breadcrumbs-root')).toContainText('Root GC');

    // Verify Grouping - Look for "Others" in Sankey labels
    const groupedNode = iframe.locator('.node-label').filter({ hasText: /Others/ }).first();
    await expect(groupedNode).toBeVisible({ timeout: 60000 });

    // Find a node WITH an ID to zoom into (one that doesn't have "Others" and isn't "Root GC")
    // Use a more specific selector to avoid the size text
    const nodeToZoom = iframe.locator('.node-label').filter({ hasText: /^((?!Others|Root GC).)*$/ }).first();
    await expect(nodeToZoom).toBeVisible();

    const nodeName = await nodeToZoom.evaluate(el => {
        const div = el.querySelector('div > div');
        return (div ? div.childNodes[0].textContent : el.textContent)?.trim();
    });
    console.log(`Zooming into: ${nodeName}`);

    // Click the node label
    await nodeToZoom.click({ force: true });

    // Verify Breadcrumbs updated
    await expect(iframe.locator('.mantine-Breadcrumbs-root')).toContainText('Root GC');
    await expect(iframe.locator('.mantine-Breadcrumbs-root')).toContainText(nodeName!, { timeout: 10000 });

    // Switch to Sunburst and verify
    await iframe.getByRole('textbox', { name: 'Visualization type' }).click();
    await iframe.getByRole('option', { name: 'Sunburst' }).click();
    await expect(iframe.locator('.sunburst-svg')).toBeVisible();

    // Navigate back via Breadcrumb
    await iframe.locator('.mantine-Breadcrumbs-root a').filter({ hasText: 'Root GC' }).click();
    await expect(iframe.locator('.mantine-Breadcrumbs-root')).not.toContainText(nodeName!);
    await expect(iframe.locator('.mantine-Breadcrumbs-root')).toContainText('Root GC');
});
