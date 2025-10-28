import { test, expect } from '@playwright/test';

test('should allow switching between handlers for the same file', async ({ page }) => {
    // Load the integration test harness which hosts an iframe and driver.js
    await page.goto('/tests/integration/driver.html');

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

    // Wait for the iframe element and its content to be visible
    await page.waitForSelector('#file-handler-iframe', { state: 'attached', timeout: 10000 });
    const iframeEl = await page.$('#file-handler-iframe');
    const frame = iframeEl ? await iframeEl.contentFrame() : null;
    if (!frame) throw new Error('file-handler iframe contentFrame is null');
    await frame.waitForSelector('h1', { state: 'visible', timeout: 10000 });
    const iframe = page.frameLocator('#file-handler-iframe');
    await expect(iframe.locator('h1')).toHaveText('Hello, Markdown!');

    // Now switch the same iframe to the text handler and ensure it shows raw text
    await page.evaluate(() => {
        const iframe = document.getElementById('file-handler-iframe') as HTMLIFrameElement;
        iframe.src = '/textviewer/index.html';
    });

    // Wait for the textviewer to load and render the raw text
    await page.waitForSelector('#file-handler-iframe', { state: 'attached', timeout: 10000 });
    const iframeEl2 = await page.$('#file-handler-iframe');
    const frame2 = iframeEl2 ? await iframeEl2.contentFrame() : null;
    if (!frame2) throw new Error('file-handler iframe contentFrame is null after switch');
    await frame2.waitForSelector('body', { state: 'visible', timeout: 10000 });
    await expect(page.frameLocator('#file-handler-iframe').locator('body')).toContainText('# Hello, Markdown!');
});
