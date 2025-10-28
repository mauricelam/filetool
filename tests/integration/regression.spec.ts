import { test, expect } from '@playwright/test';

test('should allow switching between handlers for the same file', async ({ page }) => {
    // Load the integration test harness which hosts an iframe and driver.js
    await page.goto('/tests/integration/driver.html');

    // Point the harness iframe at the markdown handler and provide the file via postMessage
    await page.evaluate(() => {
        const iframe = document.getElementById('file-handler-iframe') as HTMLIFrameElement;
        iframe.src = '/markdown/index.html';
        // Tell the driver which file to provide to the handler when it requests it
        window.postMessage({
            action: 'setFile',
            file: {
                content: '# Hello, Markdown!',
                name: 'test.md',
                type: 'text/markdown'
            }
        }, '*');
    });

    // Wait for the iframe and verify the markdown handler rendered the heading
    const iframe = page.frameLocator('#file-handler-iframe');
    await expect(iframe.locator('h1')).toHaveText('Hello, Markdown!');

    // Now switch the same iframe to the text handler and ensure it shows raw text
    await page.evaluate(() => {
        const iframe = document.getElementById('file-handler-iframe') as HTMLIFrameElement;
        iframe.src = '/textviewer/index.html';
    });

    await expect(iframe.locator('body')).toContainText('# Hello, Markdown!');
});
