const { test, expect } = require('@playwright/test');

const runHandlerTest = async (page, { handler, file, expectedText }) => {
    // Navigate to the test harness page with the specified handler
    await page.goto(`http://localhost:8080/tests/integration/driver.html?handler=${handler}`);

    // Get a reference to the iframe's content frame
    const iframe = await page.locator('#file-handler-iframe').contentFrame();

    // Send the file to the driver harness
    await page.evaluate((file) => {
        window.postMessage({
            action: 'setFile',
            file: file
        }, '*');
    }, file);

    // Assert that the content is displayed.
    await expect(iframe.locator('body')).toContainText(expectedText);
};

test('should correctly process and display a text file in the textviewer', async ({ page }) => {
    await runHandlerTest(page, {
        handler: 'textviewer',
        file: {
            content: 'This is the content of the test file.',
            name: 'test.txt',
            type: 'text/plain'
        },
        expectedText: 'This is the content of the test file.'
    });
});

test('should correctly process and display a markdown file in the markdown viewer', async ({ page }) => {
    await runHandlerTest(page, {
        handler: 'markdown',
        file: {
            content: '# Hello, Markdown!',
            name: 'test.md',
            type: 'text/markdown'
        },
        expectedText: 'Hello, Markdown!'
    });
});
