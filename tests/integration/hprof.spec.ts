import { test, expect } from '@playwright/test';

test('HPROF viewer should display file content', async ({ page }) => {
    // Navigate to the HPROF viewer directly with the test flag
    await page.goto('http://localhost:8080/filetool/hprof/index.html?test=true');

    // Wait for the loading to complete
    await expect(page.locator('h2')).toContainText('HPROF Viewer: test.hprof', { timeout: 15000 });

    // Check if the format and ID size are displayed
    await expect(page.locator('#output')).toContainText('Format: JAVA PROFILE 1.0.1');
    await expect(page.locator('#output')).toContainText('ID Size: 4 bytes');

    // Check if records are listed in the sidebar
    await expect(page.locator('.record-item').filter({ hasText: 'Utf8' }).first()).toBeVisible();
    await expect(page.locator('.record-item').filter({ hasText: 'LoadClass' }).first()).toBeVisible();
    await expect(page.locator('.record-item').filter({ hasText: 'HeapDumpSegment' }).first()).toBeVisible();

    // Click on the HeapDumpSegment record and check details
    await page.locator('.record-item').filter({ hasText: 'HeapDumpSegment' }).first().click();

    // Check if details area contains "Heap Dump Summary" (it's in the text content)
    await expect(page.locator('#output')).toContainText('Heap Dump Summary', { timeout: 10000 });

    // Test Instance Counts tab
    await page.locator('div').filter({ hasText: /^Instance Counts$/ }).click();
    await expect(page.locator('table')).toContainText('java.lang.Object', { timeout: 15000 });
    await expect(page.locator('table')).toContainText('1');

    // Test Reference Graph tab
    await page.locator('div').filter({ hasText: /^Reference Graph$/ }).click();
    // Graphviz takes time to render
    await expect(page.locator('svg')).toBeVisible({ timeout: 20000 });
});
