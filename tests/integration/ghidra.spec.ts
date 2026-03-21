import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Ghidra Decompiler', () => {
    test('should correctly detect ELF and offer Ghidra', async ({ page }) => {
        // Increase timeout for the whole test as build/load can be slow
        test.setTimeout(120000);

        await page.goto('http://localhost:8080/filetool/');

        const fixturePath = path.resolve('binutils/example/libhello.so');
        const buffer = fs.readFileSync(fixturePath);

        await page.evaluate(({content, name}) => {
            const file = new File([new Uint8Array(content)], name, { type: 'application/octet-stream' });
            window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
        }, { content: Array.from(buffer), name: 'libhello.so' });

        // Wait for magic detection to complete
        await expect(page.locator('.filedescription')).not.toHaveText('Loading...', { timeout: 15000 });

        // It should offer the "Ghidra" handler
        await expect(page.locator('.handler-button, .buttonBar button', { hasText: 'Ghidra' })).toBeVisible({ timeout: 15000 });

        // Open Ghidra
        await page.locator('.handler-button, .buttonBar button', { hasText: 'Ghidra' }).click();

        // Switch to the iframe
        const iframeEl = await page.waitForSelector('iframe[src*="ghidra"]', { timeout: 20000 });
        const iframe = await iframeEl.contentFrame();
        if (!iframe) throw new Error("Could not get Ghidra iframe");

        // Wait for architecture detection in the UI
        await expect(iframe.getByText(/Detected: x86:LE:64:default/)).toBeVisible({ timeout: 60000 });

        // Wait for symbols to load.
        // Debug: list all text in the iframe if it fails
        try {
            await expect(iframe.locator('div').filter({ hasText: /^_?init$/ }).first()).toBeVisible({ timeout: 60000 });
        } catch (e) {
            const bodyText = await iframe.locator('body').innerText();
            console.log('Iframe inner text:', bodyText);
            // Check for potential errors
            const errorText = await iframe.locator('[style*="color: #ff4d4f"]').innerText().catch(() => '');
            if (errorText) console.log('Iframe error text:', errorText);
            throw e;
        }

        // Click on _init to decompile
        await iframe.locator('div').filter({ hasText: /^_?init$/ }).first().click();

        // Wait for decompilation status
        await expect(iframe.getByText(/Decompiling _?init\.\.\./)).toBeVisible({ timeout: 10000 });
        await expect(iframe.getByText('Decompilation complete.')).toBeVisible({ timeout: 60000 });

        // Check for decompiled output (Ace editor)
        const editor = iframe.locator('.ace_content');
        await expect(editor).toContainText('void _init');
    });
});
