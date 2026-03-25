import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('HPROF viewer should support static and force graph modes', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../../hprof/example/test.hprof');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'hprof',
        file: {
            content: fileContent,
            name: 'test.hprof',
            type: ''
        }
    });

    // Wait for the loading to complete
    await expect(iframe.locator('h2')).toContainText('HPROF Viewer: test.hprof', { timeout: 15000 });

    // Test Reference Graph tab
    await iframe.locator('div').filter({ hasText: /^Reference Graph$/ }).click();

    // Check static mode (default)
    await expect(iframe.locator('select').first()).toHaveValue('static');
    await expect(iframe.locator('svg')).toBeVisible({ timeout: 20000 });
    // Graphviz adds title tag to svg
    await expect(iframe.locator('svg title').first()).toBeAttached({ timeout: 10000 });

    // Switch to force mode
    await iframe.locator('select').first().selectOption('force');
    // Force graph uses rects for nodes
    await expect(iframe.locator('rect').first()).toBeVisible({ timeout: 10000 });

    // Test Hierarchy tab (should not contain java.lang.Object in the graph)
    await iframe.locator('div').filter({ hasText: /^Hierarchy$/ }).click();
    await expect(iframe.locator('rect').first()).toBeVisible({ timeout: 10000 });
    // It shouldn't be in the SVG
    await expect(iframe.locator('svg')).not.toContainText('java.lang.Object');
});
