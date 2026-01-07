import { test, expect, Page } from '@playwright/test';
import { runHandlerTest } from './test-utils';

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
