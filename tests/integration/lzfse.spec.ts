
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('LZFSE Handler', () => {
    test('should decompress an LZFSE file and display the content', async ({ page }) => {
        // Navigate to the main page
        await page.goto('/');

        // Find the file input element and upload the test fixture
        const fileInput = await page.locator('input[type="file"]');
        const filePath = path.join(__dirname, '..', 'fixtures', 'test.txt.lzfse');
        await fileInput.setInputFiles(filePath);

        // Wait for the LZFSE handler to be loaded in an iframe
        const iframe = await page.waitForSelector('iframe[src*="lzfse"]');
        const frame = await iframe.contentFrame();
        await frame.waitForLoadState('domcontentloaded');

        // Check for the decompressed content within the iframe
        // The original content is "This is a test file for LZFSE decompression."
        // We will check for the hex representation of the first few characters.
        const expectedHex = '54 68 69 73 20 69 73 20 61 20 74 65 73 74 20 66'; // "This is a test f"
        const content = await frame.locator('pre').textContent();
        expect(content).toContain(expectedHex);
    });
});
