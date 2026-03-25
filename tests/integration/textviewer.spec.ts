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
    // Use a more robust selector that doesn't rely on the icon
    const textViewerButton = page.locator('button', { hasText: 'Text Viewer' });
    await textViewerButton.click();

    // Wait for the iframe to be visible
    const iframeLocator = page.locator('#framecontainer iframe');
    await expect(iframeLocator).toBeVisible({ timeout: 10000 });

    const iframe = page.frameLocator('#framecontainer iframe');

    // Check that the content is rendered in the Ace editor
    // Ace uses 'ace_content' class for the main text area
    await expect(iframe.locator('.ace_content')).toContainText('project', { timeout: 15000 });
    await expect(iframe.locator('.ace_content')).toContainText('filetool');

    // Check for the presence of folding widgets
    // Ace uses 'ace_fold-widget' class for the fold icons
    const foldWidgets = iframe.locator('.ace_fold-widget');
    await expect(foldWidgets.first()).toBeVisible();

    // Verify there are at least two fold widgets for our JSON (root object and features array)
    const count = await foldWidgets.count();
    expect(count).toBeGreaterThanOrEqual(2);
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

    // XML should default to Text Viewer, but let's be safe if there are other matches
    const textViewerButton = page.locator('button', { hasText: 'Text Viewer' });
    await textViewerButton.click();

    const iframe = page.frameLocator('#framecontainer iframe');
    await expect(iframe.locator('.ace_content')).toContainText('root', { timeout: 15000 });

    const foldWidgets = iframe.locator('.ace_fold-widget');
    await expect(foldWidgets.first()).toBeVisible();

    const count = await foldWidgets.count();
    expect(count).toBeGreaterThanOrEqual(3); // root, and two item tags
});
