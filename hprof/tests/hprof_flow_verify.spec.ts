import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

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

    // Verify Grouping - Look for "Others" or "(N classes)" in Sankey labels
    const groupedNode = iframe.locator('.node-label').filter({ hasText: /Others|\(\d+ classes\)/ }).first();
    await expect(groupedNode).toBeVisible({ timeout: 60000 });

    // Find a node WITH an ID to zoom into (one that doesn't have "classes)" and isn't "Root GC")
    // Use a more specific selector to avoid the size text
    const nodeToZoom = iframe.locator('.node-label').filter({ hasText: /^((?!classes\)|Root GC).)*$/ }).first();
    await expect(nodeToZoom).toBeVisible();

    const nodeName = await nodeToZoom.locator('div > div').evaluate(el => el.childNodes[0].textContent?.trim());
    console.log(`Zooming into: ${nodeName}`);

    // Click the rect for this node. In Sankey, nodes have titles.
    await iframe.locator('rect').filter({ has: iframe.locator(`title:has-text("${nodeName}")`) }).first().click();

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
