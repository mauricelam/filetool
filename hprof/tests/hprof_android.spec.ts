import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('Android HPROF viewer should display file content', async ({ page }) => {
    test.setTimeout(90000);
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

    // Check if the format and ID size are displayed
    // Note: Our parser now normalizes 1.0.3 to 1.0.2 for compatibility
    await expect(iframe.locator('#output')).toContainText('Format: JAVA PROFILE 1.0.2');
    await expect(iframe.locator('#output')).toContainText('ID Size: 4 bytes');

    // Check if records are listed in the sidebar
    await expect(iframe.locator('.record-item').filter({ hasText: 'Utf8' }).first()).toBeVisible({ timeout: 30000 });

    // In large android hprof, we might need to scroll or wait for HeapDumpSegment to appear in the first page
    // but here we just check if it's there at all in the records list
    await iframe.getByPlaceholder('Search').first().fill('HeapDumpSegment');
    await expect(iframe.locator('.record-item').filter({ hasText: 'HeapDumpSegment' }).first()).toBeVisible({ timeout: 15000 });
    await iframe.getByPlaceholder('Search').first().fill('');

    // Test Instance Counts tab
    await iframe.getByRole('tab', { name: 'Instance Counts' }).click();
    // Wait for loading to finish
    await expect(iframe.locator('text=Analyzing heap dump...')).not.toBeVisible({ timeout: 60000 });
    // In this specific android.hprof, many names are just simple strings or use / instead of .
    const androidTable = iframe.getByRole('tabpanel', { name: 'Instance Counts' }).locator('table');
    await expect(androidTable).toContainText('java.lang.String', { timeout: 30000 });
});

test('Java HPROF (8-byte ID) viewer should display file content', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/java.hprof');
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
    await iframe.getByRole('tab', { name: 'Instance Counts' }).click();
    // Wait for loading to finish
    await expect(iframe.locator('text=Analyzing heap dump...')).not.toBeVisible({ timeout: 30000 });
    // Use regex to handle both . and /
    const javaTable = iframe.getByRole('tabpanel', { name: 'Instance Counts' }).locator('table');
    await expect(javaTable).toContainText(/java[./]lang[./]Integer/, { timeout: 30000 });
});
