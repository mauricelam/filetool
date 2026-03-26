import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Ghidra Decompiler - protoc-linux-aarch64', () => {
    test.setTimeout(120000);

    test('should correctly decompile main in protoc-linux-aarch64', async ({ page }) => {
        // Capture console logs from the page to help debug worker issues
        page.on('console', msg => {
            const txt = msg.text();
            console.log(`PAGE LOG: ${txt}`);
            if (txt.includes('Image XML size')) {
                console.log('--- XML constructed successfully ---');
            }
        });

        await page.goto('http://localhost:8080/filetool/');

        const fixturePath = path.resolve('ghidra/example/protoc-linux-aarch64');
        const buffer = fs.readFileSync(fixturePath);

        await page.evaluate(({content, name}) => {
            const file = new File([new Uint8Array(content)], name, { type: 'application/octet-stream' });
            window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
        }, { content: Array.from(buffer), name: 'protoc-linux-aarch64' });

        // Wait for magic detection to complete
        await expect(page.locator('.filedescription')).not.toHaveText('Loading...', { timeout: 60000 });

        // It should offer the "Ghidra" handler
        await expect(page.locator('.handler-button, .buttonBar button', { hasText: 'Ghidra' })).toBeVisible({ timeout: 15000 });

        // Open Ghidra
        await page.locator('.handler-button, .buttonBar button', { hasText: 'Ghidra' }).click();

        // Switch to the iframe
        const iframeEl = await page.waitForSelector('iframe[src*="ghidra"]', { timeout: 30000 });
        const iframe = await iframeEl.contentFrame();
        if (!iframe) throw new Error("Could not get Ghidra iframe");

        // Wait for architecture detection in the UI
        await expect(iframe.getByText(/Detected: AARCH64:LE:64:v8A/)).toBeVisible({ timeout: 60000 });

        // Wait for symbols to load.
        await expect(iframe.getByPlaceholder('Search symbols...')).toBeVisible({ timeout: 120000 });

        // Search for main explicitly to ensure it's in the list
        await iframe.getByPlaceholder('Search symbols...').fill('main');
        await page.waitForTimeout(1000); // Wait for filtering

        // Get function address for logging
        const symEl = iframe.locator('div').filter({ hasText: /^main$/ }).first();
        await expect(symEl).toBeVisible({ timeout: 20000 });
        const symText = await symEl.innerText();
        console.log(`Found main symbol: ${symText}`);

        // Click on main to decompile
        await iframe.locator('div').filter({ hasText: /^main$/ }).first().click();

        // Wait for decompilation status
        await expect(iframe.getByText(/Decompiling main\.\.\./)).toBeVisible({ timeout: 10000 });

        // Wait for decompilation to complete or fail
        try {
            await expect(iframe.getByText('Decompilation complete.')).toBeVisible({ timeout: 420000 });
        } catch (e) {
            console.log('Decompilation error or timeout occurred.');
            // Check if page/iframe crashed
            if (page.isClosed()) {
                throw new Error('Page closed during decompilation.');
            }
            try {
                const errorText = await iframe.locator('[style*="color: #ff4d4f"]').innerText({ timeout: 5000 }).catch(() => '');
                if (errorText) {
                    throw new Error(`Decompilation failed with error: ${errorText}`);
                }
                const bodyText = await iframe.locator('body').innerText({ timeout: 5000 });
                console.log('Iframe inner text on failure:', bodyText);
            } catch (innerError) {
                console.log('Could not retrieve error details from iframe (it may have crashed).');
            }
            throw e;
        }

        // Check for decompiled output (Ace editor)
        const editor = iframe.locator('.ace_content');
        await expect(editor).toContainText(' main(');
    });
});
