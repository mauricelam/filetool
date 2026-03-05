import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('APK Viewer should display APK contents, metadata and resources', async ({ page }) => {
    // Increase test timeout as APK decoding can be very slow in some environments
    test.setTimeout(120000);

    const filePath = path.resolve(__dirname, '../../binaryxml/example/Tasker.6.6.20.apk');
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
    await expect(iframe.locator('h3:has-text("APK Contents")')).toBeVisible({ timeout: 30000 });

    // 2. Verify the file tree contains expected entries
    await expect(iframe.locator('.item-name >> text="AndroidManifest.xml"')).toBeVisible();
    await expect(iframe.locator('.item-name >> text="resources.arsc"')).toBeVisible();

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
    // Use title attribute which is present on .column-item
    const resourcesArscItem = iframe.locator('.column-item[title="resources.arsc"]');
    await resourcesArscItem.scrollIntoViewIfNeeded();
    await resourcesArscItem.click();

    // Increased timeout for resource table extraction as it can be slow in CI
    await expect(iframe.locator('h3:has-text("Resource Table")')).toBeVisible({ timeout: 60000 });
});
