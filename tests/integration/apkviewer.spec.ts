import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('APK Viewer should display APK contents, metadata and resources', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../fixtures/Tasker.6.6.20.apk');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'binaryxml',
        file: {
            content: fileContent,
            name: 'Tasker.6.6.20.apk',
            type: 'application/vnd.android.package-archive'
        }
    });

    // 1. Verify "APK Contents" header is visible
    await expect(iframe.locator('h3:has-text("APK Contents")')).toBeVisible({ timeout: 15000 });

    // 2. Verify the file tree contains expected entries
    await expect(iframe.locator('text="AndroidManifest.xml"')).toBeVisible();
    await expect(iframe.locator('text="resources.arsc"')).toBeVisible();

    // 3. Click "View APK Metadata" and verify metadata view
    await iframe.locator('button:has-text("View APK Metadata")').click();
    await expect(iframe.locator('h2:has-text("APK Metadata")')).toBeVisible();
    await expect(iframe.locator('h3:has-text("App Information")')).toBeVisible();
    await expect(iframe.locator('h3:has-text("Archive Details")')).toBeVisible();

    // Check for package name (Tasker's package name)
    await expect(iframe.locator('text="net.dinglisch.android.taskerm"')).toBeVisible();

    // 4. Navigate back to files
    await iframe.locator('button:has-text("Back to Files")').click();
    await expect(iframe.locator('h3:has-text("APK Contents")')).toBeVisible();

    // 5. Click on resources.arsc and verify Resource Table view
    // In ColumnView, we might need to click the item.
    // It's likely a div or span containing the text.
    await iframe.locator('text="resources.arsc"').click();
    await expect(iframe.locator('h3:has-text("Resource Table")')).toBeVisible();
});
