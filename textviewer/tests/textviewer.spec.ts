import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('textviewer should display folding widgets for JSON file', async ({ page }) => {
    const content = JSON.stringify({
        "project": "filetool",
        "features": ["viewing", "editing", "searching"],
        "details": {
            "active": true,
            "version": 1.0
        }
    }, null, 2);

    const iframe = await runHandlerTest(page, {
        handler: 'textviewer',
        file: {
            content: content,
            name: 'test.json',
            type: 'application/json'
        }
    });

    // Check that the content is rendered in the Ace editor
    await expect(iframe.locator('.ace_content')).toContainText('project', { timeout: 15000 });
    await expect(iframe.locator('.ace_content')).toContainText('filetool');

    // Check for the presence of folding widgets
    const foldWidgets = iframe.locator('.ace_fold-widget');
    await expect(foldWidgets.first()).toBeVisible();

    // Verify there are at least two fold widgets for our JSON (root object and features array)
    const count = await foldWidgets.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Verify language selector
    const modeSelect = iframe.locator('#mode-select');
    await expect(modeSelect).toBeVisible();
    await expect(modeSelect).toHaveValue('json');

    // Change language to text
    await modeSelect.selectOption('text');
    await expect(modeSelect).toHaveValue('text');
});

test('textviewer should display folding widgets for XML file', async ({ page }) => {
    const content = `
<root>
    <item id="1">
        <name>Item 1</name>
        <description>This is a long description that could be folded.</description>
    </item>
    <item id="2">
        <name>Item 2</name>
    </item>
</root>
    `.trim();

    const iframe = await runHandlerTest(page, {
        handler: 'textviewer',
        file: {
            content: content,
            name: 'test.xml',
            type: 'text/xml'
        }
    });

    await expect(iframe.locator('.ace_content')).toContainText('root', { timeout: 15000 });

    const foldWidgets = iframe.locator('.ace_fold-widget');
    await expect(foldWidgets.first()).toBeVisible();

    const count = await foldWidgets.count();
    expect(count).toBeGreaterThanOrEqual(3); // root, and two item tags

    // Verify language selector
    const modeSelect = iframe.locator('#mode-select');
    await expect(modeSelect).toHaveValue('xml');
});

test('textviewer should support files larger than 4GB with a truncation warning', async ({ page }) => {
    await page.goto('/filetool/tests/integration/driver.html?handler=textviewer');
    await page.waitForSelector('#file-handler-iframe', { state: 'attached', timeout: 10000 });

    // Construct ~4.39 GB (> 4GB) file using Blobs in browser memory to avoid RAM duplication and Node.js OOM
    await page.evaluate(() => {
        const chunk = new Uint8Array(1024 * 1024);
        chunk.fill(65); // 'A'
        const blob = new Blob([chunk], { type: 'text/plain' });
        const chunks = new Array(4500).fill(blob);
        const file = new File(chunks, 'huge_file_4.5gb.txt', { type: 'text/plain' });
        window.postMessage({
            action: 'setFile',
            file: {
                content: file,
                name: file.name,
                type: file.type
            }
        }, '*');
    });

    const iframeEl = await page.$('#file-handler-iframe');
    const iframe = iframeEl ? await iframeEl.contentFrame() : null;
    expect(iframe).not.toBeNull();

    // Check that truncation warning banner is visible
    const warning = iframe!.locator('#truncation-warning');
    await expect(warning).toBeVisible({ timeout: 15000 });
    await expect(warning).toContainText('File is too large');
    await expect(warning).toContainText('4.39 GB');
    await expect(warning).toContainText('Showing only the first 50 MB');

    // Verify Ace Editor renders text content without crashing
    await expect(iframe!.locator('.ace_content')).toContainText('AAAAA');
});
