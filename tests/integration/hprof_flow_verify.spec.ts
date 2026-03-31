import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test('HPROF memory flow features verification', async ({ page }) => {
    test.setTimeout(120000);

    // Use the test hprof with ?test=true
    await page.goto('http://localhost:8080/filetool/hprof/index.html?test=true');

    const iframe = page.frameLocator('iframe').first(); // If nested, or just page if direct
    // In our case it's the direct page but let's check.
    // The driver.ts loads the handler in an iframe.
    // Wait for the viewer to load
    await expect(page.locator('h2')).toContainText('HPROF Viewer: test.hprof', { timeout: 30000 });

    // Switch to Memory Flow tab
    await page.getByRole('tab', { name: 'Memory Flow' }).click();

    // Verify Breadcrumbs - initial state
    await expect(page.locator('.mantine-Breadcrumbs-root')).toContainText('Root GC');

    // Verify Grouping - Look for "(N objects)" in Sankey labels
    const groupedNode = page.locator('.node-label').filter({ hasText: /objects\)/ }).first();
    await expect(groupedNode).toBeVisible({ timeout: 30000 });

    // Find a node WITH an ID to zoom into (one that doesn't have "objects)" and isn't "Root GC")
    // Use a more specific selector to avoid the size text
    const nodeToZoom = page.locator('.node-label').filter({ hasText: /^((?!objects\)|Root GC).)*$/ }).first();
    await expect(nodeToZoom).toBeVisible();

    const nodeName = await nodeToZoom.locator('div > div').evaluate(el => el.childNodes[0].textContent?.trim());
    console.log(`Zooming into: ${nodeName}`);

    // Click the rect for this node. In Sankey, nodes have titles.
    await page.locator('rect').filter({ has: page.locator(`title:has-text("${nodeName}")`) }).first().click();

    // Verify Breadcrumbs updated
    await expect(page.locator('.mantine-Breadcrumbs-root')).toContainText('Root GC');
    await expect(page.locator('.mantine-Breadcrumbs-root')).toContainText(nodeName!, { timeout: 10000 });

    // Screenshot Sankey
    await page.screenshot({ path: '/home/jules/verification/screenshots/sankey_grouped.png' });

    // Switch to Sunburst and verify
    await page.getByRole('textbox', { name: 'Visualization type' }).click();
    await page.getByRole('option', { name: 'Sunburst' }).click();
    await expect(page.locator('.sunburst-svg')).toBeVisible();
    await page.screenshot({ path: '/home/jules/verification/screenshots/sunburst_grouped.png' });

    // Navigate back via Breadcrumb
    await page.locator('.mantine-Breadcrumbs-root a').filter({ hasText: 'Root GC' }).click();
    await expect(page.locator('.mantine-Breadcrumbs-root')).not.toContainText(nodeName!);
    await expect(page.locator('.mantine-Breadcrumbs-root')).toContainText('Root GC');
});
