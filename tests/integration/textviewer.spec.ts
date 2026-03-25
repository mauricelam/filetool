import { test, expect } from '@playwright/test';

test('textviewer should display folding widgets for JSON file', async ({ page }) => {
    await page.goto('/filetool/');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible();

    // Dispatch the 'openFiles' event with a mock JSON File object
    await page.evaluate(() => {
        const content = JSON.stringify({
            "project": "filetool",
            "features": ["viewing", "editing", "searching"],
            "details": {
                "active": true,
                "version": 1.0
            }
        }, null, 2);
        const file = new File([content], 'test.json', { type: 'application/json' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    });

    // Check that the file is displayed in the sidebar
    await expect(page.locator('.filename')).toHaveText('test.json');

    // For JSON, JQ Viewer might be the default. We need to explicitly click Text Viewer.
    const textViewerButton = page.locator('button', { hasText: 'Text Viewer' });
    await textViewerButton.click();

    // Wait for the iframe to be visible
    const iframeLocator = page.locator('#framecontainer iframe');
    await expect(iframeLocator).toBeVisible({ timeout: 10000 });

    const iframe = page.frameLocator('#framecontainer iframe');

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
    // Folding should disappear in text mode (most likely)
    // Actually Ace might still show some fold widgets depending on indentation,
    // but the point is we can change it.
});

test('textviewer should display folding widgets for XML file', async ({ page }) => {
    await page.goto('/filetool/');

    await page.evaluate(() => {
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
        const file = new File([content], 'test.xml', { type: 'text/xml' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    });

    await expect(page.locator('.filename')).toHaveText('test.xml');

    const textViewerButton = page.locator('button', { hasText: 'Text Viewer' });
    await textViewerButton.click();

    const iframe = page.frameLocator('#framecontainer iframe');
    await expect(iframe.locator('.ace_content')).toContainText('root', { timeout: 15000 });

    const foldWidgets = iframe.locator('.ace_fold-widget');
    await expect(foldWidgets.first()).toBeVisible();

    const count = await foldWidgets.count();
    expect(count).toBeGreaterThanOrEqual(3); // root, and two item tags

    // Verify language selector
    const modeSelect = iframe.locator('#mode-select');
    await expect(modeSelect).toHaveValue('xml');
});
