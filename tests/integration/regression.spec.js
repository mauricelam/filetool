
const { test, expect } = require('@playwright/test');

test('should allow switching between handlers for the same file', async ({ page }) => {
    await page.goto('http://localhost:8080');

    // Upload a markdown file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#droptarget').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'test.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from('# Hello, Markdown!')
    });

    // Wait for the iframe to be loaded with the default handler
    await page.waitForSelector('iframe');

    // Verify that the markdown handler is loaded (default handler)
    const iframe = page.frameLocator('iframe');
    await expect(iframe.locator('h1')).toHaveText('Hello, Markdown!');

    // Switch to the text handler
    await page.getByRole('button', { name: 'Text' }).click();

    // Verify that the text handler is loaded. It shows raw text.
    await expect(iframe.locator('body')).toContainText('# Hello, Markdown!');
});
