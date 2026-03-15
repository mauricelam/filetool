
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { runHandlerTest } from './test-utils';

test.describe('Decompressor Handler', () => {
    test('should decompress an LZFSE file and display the content', async ({ page }) => {
        const filePath = path.join(__dirname, '../../decompressor/example', 'test.lzfse');
        const fileBuffer = fs.readFileSync(filePath);
        await runHandlerTest(page, {
            handler: 'decompressor',
            file: {
                content: Uint8Array.from(fileBuffer),
                name: 'test.lzfse',
                type: 'application/octet-stream'
            },
        });

        // Wait for the decompressor handler to be loaded in an iframe
        const iframe = await page.waitForSelector('iframe[src*="decompressor"]');
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
