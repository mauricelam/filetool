import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('BplistViewer should display the content of a binary plist file', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../fixtures/sample.bplist');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'bplistviewer',
        file: {
            content: fileContent,
            name: 'sample.bplist',
            type: 'application/x-plist'
        }
    });

    await expect(iframe.locator('text="some-key"')).toBeVisible();
    await expect(iframe.locator('text="some-value"')).toBeVisible();
});
