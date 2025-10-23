const { test, expect } = require('@playwright/test');

const runHandlerTest = async (page, { handler, file }) => {
    // Navigate to the test harness page with the specified handler
    await page.goto(`http://localhost:8080/tests/integration/driver.html?handler=${handler}`);

    // Send the file to the driver harness
    await page.evaluate((file) => {
        window.postMessage({
            action: 'setFile',
            file: file
        }, '*');
    }, file);

    return await page.locator('#file-handler-iframe').contentFrame();
};

test('should correctly process and display a text file in the textviewer', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'textviewer',
        file: {
            content: 'This is the content of the test file.',
            name: 'test.txt',
            type: 'text/plain'
        },
    });
    await expect(iframe.locator('body')).toContainText('This is the content of the test file');
});

test('should correctly process and display a markdown file in the markdown viewer', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'markdown',
        file: {
            content: '# Hello, Markdown!',
            name: 'test.md',
            type: 'text/markdown'
        },
    });
    await expect(iframe.locator('body')).toContainText('Hello, Markdown!');
});

test('should correctly process and display a small binary file in the hex viewer', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'hex_viewer',
        file: {
            content: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
            name: 'test.bin',
            type: 'application/octet-stream'
        },
    });

    await expect(iframe.locator('body')).toContainText('00 01 02 03');
    await expect(iframe.locator('body')).toContainText('0C 0D 0E 0F');
});
