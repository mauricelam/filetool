import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';

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
    await page.goto(`/filetool/tests/integration/driver.html?handler=${handler}`);

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

test('should correctly process and display a standalone binary XML file in android-xml-viewer', async ({ page }) => {
    const xmlContent = new Uint8Array([3, 0, 8, 0, 191, 0, 0, 0, 1, 0, 28, 0, 111, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 34, 0, 0, 0, 47, 0, 0, 0, 54, 0, 0, 0, 11, 0, 83, 111, 109, 101, 32, 115, 116, 114, 105, 110, 103, 0, 0, 15, 0, 65, 110, 111, 116, 104, 101, 114, 32, 115, 114, 116, 114, 105, 110, 103, 0, 0, 9, 0, 115, 116, 97, 114, 116, 95, 116, 97, 103, 0, 0, 3, 0, 107, 101, 121, 0, 0, 5, 0, 118, 97, 108, 117, 101, 0, 0, 2, 1, 16, 0, 56, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 3, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 3, 4, 0, 0, 0, 3, 1, 16, 0, 24, 0, 0, 0, 3, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 90, 0, 0, 0]);

    const iframe = await runHandlerTest(page, {
        handler: 'android-xml-viewer',
        file: {
            content: xmlContent,
            name: 'test.xml',
            type: 'application/octet-stream'
        },
    });

    await expect(iframe.locator('h3')).toContainText('Binary XML Content');
    await expect(iframe.locator('pre')).toContainText('<start_tag key="value" />');
});

test('should correctly process and display a standalone ARSC file in android-xml-viewer', async ({ page }) => {
    const arscContent = new Uint8Array([2, 0, 12, 0, 12, 0, 0, 0, 1, 0, 0, 0]);

    const iframe = await runHandlerTest(page, {
        handler: 'android-xml-viewer',
        file: {
            content: arscContent,
            name: 'test.arsc',
            type: 'application/octet-stream'
        },
    });

    await expect(iframe.locator('h3')).toContainText('Resource Table');
});

test('should correctly detect standalone binary XML file and offer APK Viewer', async ({ page }) => {
    await page.goto('/filetool/');
    const xmlContent = new Uint8Array([3, 0, 8, 0, 191, 0, 0, 0, 1, 0, 28, 0, 111, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 34, 0, 0, 0, 47, 0, 0, 0, 54, 0, 0, 0, 11, 0, 83, 111, 109, 101, 32, 115, 116, 114, 105, 110, 103, 0, 0, 15, 0, 65, 110, 111, 116, 104, 101, 114, 32, 115, 114, 116, 114, 105, 110, 103, 0, 0, 9, 0, 115, 116, 97, 114, 116, 95, 116, 97, 103, 0, 0, 3, 0, 107, 101, 121, 0, 0, 5, 0, 118, 97, 108, 117, 101, 0, 0, 2, 1, 16, 0, 56, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 3, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 3, 4, 0, 0, 0, 3, 1, 16, 0, 24, 0, 0, 0, 3, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 90, 0, 0, 0]);

    await page.evaluate((content) => {
        const file = new File([content], 'AndroidManifest.xml', { type: 'application/octet-stream' });
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    }, xmlContent);

    // Wait for magic detection to complete
    await expect(page.locator('.filedescription')).not.toHaveText('Loading...', { timeout: 15000 });

    // It should offer the "APK Viewer"
    const description = await page.locator('.filedescription').textContent();
    const buttons = await page.locator('.handler-button, .buttonBar button').allTextContents();
    await expect(page.locator('.handler-button, .buttonBar button', { hasText: 'APK' }), `Expected handler to be visible. Description was: ${description}. Available buttons: ${buttons.join(', ')}`).toBeVisible({ timeout: 15000 });
});
