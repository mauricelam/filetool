import { test, expect, Page, FrameLocator } from '@playwright/test';

const runHandlerTest = async (
    page: Page,
    { handler, file }: { handler: string; file: { content: string; name: string; type: string } }
): Promise<FrameLocator> => {
    // Navigate to the test harness page with the specified handler
    await page.goto(`/tests/integration/driver.html?handler=${handler}`);

    // Send the file to the driver harness
    await page.evaluate((file) => {
        window.postMessage({
            action: 'setFile',
            file: file
        }, '*');
    }, file);

    return page.frameLocator('#file-handler-iframe');
};

test('should correctly deobfuscate a class name', async ({ page }: { page: Page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'proguardviewer',
        file: {
            content: 'com.example.MyClass -> a.b.c:',
            name: 'test.map',
            type: 'text/plain'
        },
    });

    const frame = page.frameLocator('#file-handler-iframe');
    await frame.getByRole('textbox', { name: 'Paste obfuscated class name or stack trace here' }).fill('a.b.c');
    await frame.locator('button:has-text("Deobfuscate Name")').click();

    await expect(frame.locator('pre').last()).toContainText('com.example.MyClass');
});
