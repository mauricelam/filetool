
import { test, expect, FrameLocator, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const runHandlerTest = async (
    page: Page,
    { handler, file }: { handler: string; file: { content: string | Uint8Array; name: string; type: string } }
): Promise<FrameLocator> => {
    // Navigate to the test harness page with the specified handler
    await page.goto(`/tests/integration/driver.html?handler=${handler}`);

    // Ensure the iframe element is attached before posting the file
    await page.waitForSelector('#file-handler-iframe', { state: 'attached', timeout: 10000 });

    // Send the file to the driver harness
    await page.evaluate((file) => {
        window.postMessage({
            action: 'setFile',
            file: file
        }, '*');
    }, file);

    // Wait for iframe content to be available
    const iframeEl = await page.$('#file-handler-iframe');
    const contentFrame = iframeEl ? await iframeEl.contentFrame() : null;
    if (!contentFrame) {
        throw new Error('file-handler iframe contentFrame is null');
    }

    // Wait for the handler's document body to be ready
    await contentFrame.waitForSelector('body', { state: 'visible', timeout: 10000 });

    return page.frameLocator('#file-handler-iframe');
};

test.describe('LZFSE Handler', () => {
    test('should decompress an LZFSE file and display the content', async ({ page }) => {
        const filePath = path.join(__dirname, '../fixtures', 'test.lzfse');
        const fileBuffer = fs.readFileSync(filePath);
        await runHandlerTest(page, {
            handler: 'lzfse',
            file: {
                content: Uint8Array.from(fileBuffer),
                name: 'test.lzfse',
                type: 'application/octet-stream'
            },
        });

        // Wait for the LZFSE handler to be loaded in an iframe
        const iframe = await page.waitForSelector('iframe[src*="lzfse"]');
        const frame = await iframe.contentFrame();
        await frame!.waitForLoadState('domcontentloaded');

        // Check for the decompressed content within the iframe
        // The original content is "This is a test file for LZFSE decompression."
        // We will check for the hex representation of the first few characters.
        const content = await frame!.locator('pre').textContent();
        expect(content).toContain('hello world this');
        expect(content).toContain('is a message');
    });
});
