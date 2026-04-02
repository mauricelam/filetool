import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

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
