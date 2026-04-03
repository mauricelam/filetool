import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('BplistViewer should display the content of a binary plist file', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/sample1.bplist');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'bplistviewer',
        file: {
            content: fileContent,
            name: 'sample1.bplist',
            type: 'application/x-plist'
        }
    });

    await expect(iframe.locator('text="CFBundleIdentifier"')).toBeVisible();
    await expect(iframe.locator('text=com.apple.dictionary.MySample')).toBeVisible();
});
