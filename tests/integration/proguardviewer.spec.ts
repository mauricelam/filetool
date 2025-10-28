import { test, expect, Page, FrameLocator } from '@playwright/test';

const runHandlerTest = async (
    page: Page,
    { handler, file }: { handler: string; file: { content: string; name: string; type: string } }
): Promise<FrameLocator> => {
    // Navigate to the test harness page with the specified handler
    await page.goto(`/tests/integration/driver.html?handler=${handler}`);

    // Add logging hooks to capture console/page errors in CI
    page.on('console', (msg) => console.log('PAGE CONSOLE:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
    page.on('requestfailed', (req) => console.error('REQUEST FAILED:', req.url(), req.failure()?.errorText));

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

test('should correctly deobfuscate a class name', async ({ page }: { page: Page }) => {
    await runHandlerTest(page, {
        handler: 'proguardviewer',
        file: {
            content: 'com.example.MyClass -> a.b.c:',
            name: 'test.map',
            type: 'text/plain'
        },
    });

    const frame = page.frameLocator('#file-handler-iframe');
    // Wait for input and controls to be visible before interacting
    await frame.getByRole('textbox', { name: 'Paste obfuscated class name or stack trace here' }).waitFor({ state: 'visible', timeout: 10000 });
    await frame.getByRole('textbox', { name: 'Paste obfuscated class name or stack trace here' }).fill('a.b.c');
    await frame.locator('button:has-text("Deobfuscate Name")').waitFor({ state: 'visible', timeout: 10000 });
    await frame.locator('button:has-text("Deobfuscate Name")').click();

    // Wait for the result pre element to appear and assert its content
    await frame.locator('pre').last().waitFor({ state: 'visible', timeout: 10000 });
    await expect(frame.locator('pre').last()).toContainText('com.example.MyClass');
});
