import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('Android HPROF viewer should display file content', async ({ page }) => {
    test.setTimeout(90000);
    const filePath = path.resolve(__dirname, '../../hprof/testdata/android.hprof');
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

    // Check if the format and ID size are displayed
    // Note: Our parser now normalizes 1.0.3 to 1.0.2 for compatibility
    await expect(iframe.locator('#output')).toContainText('Format: JAVA PROFILE 1.0.2');
    await expect(iframe.locator('#output')).toContainText('ID Size: 4 bytes');

    // Check if records are listed in the sidebar
    await expect(iframe.locator('.record-item').filter({ hasText: 'Utf8' }).first()).toBeVisible({ timeout: 30000 });

    // In large android hprof, we might need to scroll or wait for HeapDumpSegment to appear in the first page
    // but here we just check if it's there at all in the records list (up to PAGE_SIZE=100)
    await iframe.locator('input[placeholder="Filter records..."]').fill('HeapDumpSegment');
    await expect(iframe.locator('.record-item').filter({ hasText: 'HeapDumpSegment' }).first()).toBeVisible({ timeout: 15000 });
    await iframe.locator('input[placeholder="Filter records..."]').fill('');

    // Test Instance Counts tab
    await iframe.locator('div').filter({ hasText: /^Instance Counts$/ }).click();
    // Wait for loading to finish
    await expect(iframe.locator('text=Analyzing heap dump...')).not.toBeVisible({ timeout: 60000 });
    // In this specific android.hprof, many names are just simple strings or use / instead of .
    await expect(iframe.locator('table')).toContainText('Main', { timeout: 30000 });
});

test('Java HPROF (8-byte ID) viewer should display file content', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../../hprof/testdata/java.hprof');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'hprof',
        file: {
            content: fileContent,
            name: 'java.hprof',
            type: ''
        }
    });

    // Wait for the loading to complete
    await expect(iframe.locator('h2')).toContainText('HPROF Viewer: java.hprof', { timeout: 30000 });

    // Check if the format and ID size are displayed
    await expect(iframe.locator('#output')).toContainText('Format: JAVA PROFILE 1.0.2');
    await expect(iframe.locator('#output')).toContainText('ID Size: 8 bytes');

    // Test Instance Counts tab
    await iframe.locator('div').filter({ hasText: /^Instance Counts$/ }).click();
    // Wait for loading to finish
    await expect(iframe.locator('text=Analyzing heap dump...')).not.toBeVisible({ timeout: 30000 });
    // Use regex to handle both . and /
    await expect(iframe.locator('table')).toContainText(/java[./]lang[./]Integer/, { timeout: 30000 });
});
