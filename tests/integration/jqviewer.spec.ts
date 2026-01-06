import { test, expect, Page } from '@playwright/test';

interface HandlerTestOptions {
    handler: string;
    file: {
        content: string | Uint8Array;
        name: string;
        type: string;
    };
}

const runHandlerTest = async (page: Page, { handler, file }: HandlerTestOptions) => {
    // Navigate to the test harness page with the specified handler
    await page.goto(`/tests/integration/driver.html?handler=${handler}`);

    // Ensure the iframe is attached before posting the file
    await page.waitForSelector('#file-handler-iframe', { state: 'attached', timeout: 10000 });

    // Send the file to the driver harness
    await page.evaluate((file) => {
        window.postMessage({
            action: 'setFile',
            file: file
        }, '*');
    }, file);

    // Wait for the frame content to be ready and return it
    const iframeEl = await page.$('#file-handler-iframe');
    const iframe = iframeEl ? await iframeEl.contentFrame() : null;
    if (!iframe) {
        throw new Error('Could not find the iframe');
    }
    await iframe.waitForSelector('body', { state: 'visible', timeout: 10000 });
    return iframe;
};

const file = {
    content: JSON.stringify({
        "name": "John Doe",
        "age": 30,
        "address": {
            "street": "123 Main St",
            "city": "Anytown"
        },
        "pets": [
            { "name": "Fluffy", "type": "cat" },
            { "name": "Fido", "type": "dog" }
        ]
    }),
    name: 'test.json',
    type: 'application/json'
};

test('should correctly display the initial JSON content', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'jqviewer',
        file,
    });
    await expect(iframe.locator('body')).toContainText('John Doe');
    await expect(iframe.locator('body')).toContainText('Fluffy');
});

test('should filter with a basic jq query', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'jqviewer',
        file,
    });
    await iframe.locator('textarea').fill('.name');
    await expect(iframe.locator('body')).toContainText('John Doe');
    await expect(iframe.locator('body')).not.toContainText('Fluffy');
});

test('should filter with a more complex jq query', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'jqviewer',
        file,
    });
    await iframe.locator('textarea').fill('.pets[0].name');
    await expect(iframe.locator('body')).toContainText('Fluffy');
    await expect(iframe.locator('body')).not.toContainText('John Doe');
});

test('should display an error for an invalid jq query', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'jqviewer',
        file,
    });
    await iframe.locator('textarea').fill('.foo-bar');
    await expect(iframe.locator('body')).toContainText('error');
});
