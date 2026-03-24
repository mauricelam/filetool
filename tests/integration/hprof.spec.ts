import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('HPROF viewer should display file content', async ({ page }) => {
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

    // Check if the format and ID size are displayed
    await expect(iframe.locator('#output')).toContainText('Format: JAVA PROFILE 1.0.1');
    await expect(iframe.locator('#output')).toContainText('ID Size: 4 bytes');

    // Check if records are listed in the sidebar
    await expect(iframe.locator('.record-item').filter({ hasText: 'Utf8' }).first()).toBeVisible();
    await expect(iframe.locator('.record-item').filter({ hasText: 'LoadClass' }).first()).toBeVisible();
    await expect(iframe.locator('.record-item').filter({ hasText: 'HeapDumpSegment' }).first()).toBeVisible();

    // Click on the HeapDumpSegment record and check details
    await iframe.locator('.record-item').filter({ hasText: 'HeapDumpSegment' }).first().click();

    // Check if details area contains "Heap Dump Summary" (it's in the text content)
    await expect(iframe.locator('#output')).toContainText('Heap Dump Summary', { timeout: 10000 });

    // Test Instance Counts tab
    await iframe.locator('div').filter({ hasText: /^Instance Counts$/ }).click();
    await expect(iframe.locator('table')).toContainText('java.lang.Object', { timeout: 15000 });
    await expect(iframe.locator('table')).toContainText('1');

    // Test Reference Graph tab
    await iframe.locator('div').filter({ hasText: /^Reference Graph$/ }).click();
    // Graphviz takes time to render
    await expect(iframe.locator('svg')).toBeVisible({ timeout: 20000 });
});
