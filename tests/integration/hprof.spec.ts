import { test, expect } from '@playwright/test';

test('HPROF viewer should display file content', async ({ page }) => {
    // Navigate to the HPROF viewer directly with the test flag
    await page.goto('http://localhost:8080/filetool/hprof/index.html?test=true');

    // Wait for the loading to complete
    await expect(page.locator('h2')).toContainText('HPROF Viewer: test.hprof', { timeout: 10000 });

    // Check if the format and ID size are displayed
    await expect(page.locator('#output')).toContainText('Format: JAVA PROFILE 1.0.1');
    await expect(page.locator('#output')).toContainText('ID Size: 4 bytes');

    // Check if records are listed in the sidebar
    await expect(page.locator('.record-item').filter({ hasText: 'Utf8' })).toBeVisible();
    await expect(page.locator('.record-item').filter({ hasText: 'LoadClass' })).toBeVisible();
    await expect(page.locator('.record-item').filter({ hasText: 'HeapDumpSegment' })).toBeVisible();

    // Click on the Utf8 record and check details
    await page.locator('.record-item').filter({ hasText: 'Utf8' }).click();
    await expect(page.locator('#detail-pre')).toContainText('Utf8: java.lang.Object');

    // Click on the LoadClass record and check details
    await page.locator('.record-item').filter({ hasText: 'LoadClass' }).click();
    await expect(page.locator('#detail-pre')).toContainText('LoadClass: class_serial=1');

    // Click on the HeapDumpSegment record and check details
    await page.locator('.record-item').filter({ hasText: 'HeapDumpSegment' }).click();

    // Check if sub-records are listed
    await expect(page.locator('h4').filter({ hasText: 'Sub-records' })).toBeVisible();
    await expect(page.locator('pre').filter({ hasText: 'GcRootJniGlobal' })).toBeVisible();
});
