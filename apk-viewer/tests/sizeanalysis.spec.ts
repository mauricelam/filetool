import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('APK Viewer should display APK size analysis', async ({ page }) => {
    // Increase test timeout as APK decoding and size analysis can be very slow
    test.setTimeout(180000);

    const filePath = path.resolve(__dirname, '../example/Tasker.6.6.20.apk');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'apk-viewer',
        file: {
            content: fileContent,
            name: 'Tasker.6.6.20.apk',
            type: 'application/vnd.android.package-archive'
        }
    });

    // 1. Verify "APK Contents" header is visible
    await expect(iframe.locator('h3:has-text("APK Contents")')).toBeVisible({ timeout: 60000 });

    // 2. Click "Size Makeup" button
    await iframe.locator('button:has-text("Size Makeup")').click();

    // 3. Verify Size Makeup view
    await expect(iframe.locator('h2:has-text("Size Makeup")')).toBeVisible({ timeout: 60000 });

    // 4. Verify Treemap is visible (it's an SVG)
    await expect(iframe.locator('svg')).toBeVisible();

    // 5. Verify top-level categories in Treemap (or at least as text if labels are rendered)
    // We expect "Code", "Resources", "Lib", "Assets" or "Other" to be present in the data and likely rendered
    await expect(iframe.locator('text="Code"')).toBeVisible();
    await expect(iframe.locator('text="Resources"')).toBeVisible();

    // 6. Test drill-down: Click on "Code"
    await iframe.locator('text="Code"').first().click();

    // 7. Verify breadcrumbs updated
    await expect(iframe.locator('.mantine-Breadcrumbs-root')).toContainText('Code');

    // 8. Test toggle: Switch to "Compressed"
    await iframe.locator('label:has-text("Compressed")').click();

    // 9. Go back
    await iframe.locator('button:has-text("Up")').click();
    await expect(iframe.locator('h2:has-text("Size Makeup")')).toBeVisible();
});
