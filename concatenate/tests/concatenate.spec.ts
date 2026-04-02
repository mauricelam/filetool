import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

test('should correctly concatenate multiple files and send openFile message', async ({ page }) => {
    const file1Content = 'Hello ';
    const file2Content = 'World!';

    const iframe = await runHandlerTest(page, {
        handler: 'concatenate',
        file: {
            content: file1Content,
            name: 'file1.txt',
            type: 'text/plain'
        },
        additionalFiles: [
            {
                content: file2Content,
                name: 'file2.txt',
                type: 'text/plain'
            }
        ]
    });

    // Check that the concatenate view is visible
    await expect(iframe.getByText(/Concatenate Files/)).toBeVisible({ timeout: 15000 });
    await expect(iframe.getByText(/file1\.txt/)).toBeVisible();
    await expect(iframe.getByText(/file2\.txt/)).toBeVisible();

    // Check for the "Concatenate and Open" button
    const openButton = iframe.locator('button', { hasText: 'Concatenate and Open' });
    await expect(openButton).toBeVisible();

    // Set a custom filename
    const filenameInput = iframe.locator('input[type="text"]');
    await filenameInput.fill('output.bin');

    // Prepare to catch the 'openFile' message via console log in the driver
    const messagePromise = page.waitForEvent('console', {
        predicate: msg => msg.text().includes('Message received from iframe') && msg.text().includes('openFile')
    });

    // Click "Concatenate and Open"
    await openButton.click();

    // Wait for the message to be logged
    const msg = await messagePromise;
    const eventData = msg.args()[1];
    const fileName = await eventData.evaluate(data => (data as any).file.name);
    expect(fileName).toBe('output.bin');
});
