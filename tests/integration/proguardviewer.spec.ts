const { test, expect } = require('@playwright/test');

const runHandlerTest = async (page, { handler, file }) => {
    // Navigate to the test harness page with the specified handler
    await page.goto(`/tests/integration/driver.html?handler=${handler}`);

    // Send the file to the driver harness
    await page.evaluate((file) => {
        window.postMessage({
            action: 'setFile',
            file: file
        }, '*');
    }, file);

    return await page.locator('#file-handler-iframe').contentFrame();
};

test('should correctly deobfuscate a class name', async ({ page }) => {
    const iframe = await runHandlerTest(page, {
        handler: 'proguardviewer',
        file: {
            content: 'com.example.MyClass -> a.b.c:',
            name: 'test.map',
            type: 'text/plain'
        },
    });

    await iframe.locator('textarea').fill('a.b.c');
    await iframe.locator('button:has-text("Deobfuscate Name")').click();

    await expect(iframe.locator('pre').last()).toContainText('com.example.MyClass');
});
