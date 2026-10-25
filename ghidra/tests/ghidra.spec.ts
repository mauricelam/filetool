import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from "../../tests/fixtures";
import { runHandlerTest } from '@filetool/integration-test-harness';

test.describe('Ghidra Decompiler', () => {
    test('should correctly decompile ELF in Ghidra', async ({ page }) => {
        // Increase timeout for the whole test as build/load can be slow
        test.setTimeout(120000);

        const fixturePath = path.resolve('binutils/example/libhello.so');
        const buffer = fs.readFileSync(fixturePath);

        const iframe = await runHandlerTest(page, {
            skipOffline: true, // Skip setOffline: WASM/specs are fetched lazily upon file open
            handler: 'ghidra',
            file: {
                content: buffer,
                name: 'libhello.so',
                type: 'application/octet-stream'
            }
        });

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

    test('should extract symbols from .gnu_debugdata in Ghidra', async ({ page }) => {
        test.setTimeout(120000);

        const fixturePath = path.resolve('ghidra/example/libcodec2.so');
        const buffer = fs.readFileSync(fixturePath);

        const iframe = await runHandlerTest(page, {
            skipOffline: true, // Skip setOffline: WASM/specs are fetched lazily upon file open
            handler: 'ghidra',
            file: {
                content: buffer,
                name: 'libcodec2.so',
                type: 'application/octet-stream'
            }
        });

        // Wait for architecture detection in the UI
        await expect(iframe.getByText(/Detected: ARM:LE:32/)).toBeVisible({ timeout: 60000 });

        // Verify symbols from .gnu_debugdata are extracted and rendered in the symbol sidebar
        await expect(iframe.locator('div').filter({ hasText: /^__on_dlclose$/ }).first()).toBeVisible({ timeout: 60000 });
        await expect(iframe.locator('div').filter({ hasText: /^__emutls_unregister_key$/ }).first()).toBeVisible({ timeout: 60000 });
    });
});
