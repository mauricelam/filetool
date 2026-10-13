import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test.describe('Ghidra Decompiler', () => {
    test('should correctly decompile ELF in Ghidra', async ({ page }) => {
        // Increase timeout for the whole test as build/load can be slow
        test.setTimeout(120000);

        const fixturePath = path.resolve('binutils/example/libhello.so');
        const buffer = fs.readFileSync(fixturePath);

        const iframe = await runHandlerTest(page, {
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
        try {
            await expect(iframe.locator('div').filter({ hasText: /^_?init$/ }).first()).toBeVisible({ timeout: 60000 });
        } catch (e) {
            const bodyText = await iframe.locator('body').innerText();
            console.log('Iframe inner text:', bodyText);
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

    test('should allow function and variable renaming in Ghidra and persist to localStorage', async ({ page }) => {
        test.setTimeout(120000);

        const fixturePath = path.resolve('binutils/example/libhello.so');
        const buffer = fs.readFileSync(fixturePath);

        const iframe = await runHandlerTest(page, {
            handler: 'ghidra',
            file: {
                content: buffer,
                name: 'libhello.so',
                type: 'application/octet-stream'
            }
        });

        await expect(iframe.getByText(/Detected: x86:LE:64:default/)).toBeVisible({ timeout: 60000 });

        // Wait for symbols
        const initSymbolItem = iframe.locator('.symbol-item').filter({ hasText: '_init' }).first();
        await expect(initSymbolItem).toBeVisible({ timeout: 60000 });

        // Rename function _init to custom_init_func
        await initSymbolItem.locator('.rename-func-btn').click();

        await expect(iframe.locator('.rename-input')).toBeVisible();
        await iframe.locator('.rename-input').fill('custom_init_func');
        await iframe.locator('.confirm-rename-btn').click();

        // Verify symbol list shows custom_init_func
        const renamedSymbolItem = iframe.locator('.symbol-item').filter({ hasText: 'custom_init_func' }).first();
        await expect(renamedSymbolItem).toBeVisible();

        // Click custom_init_func to decompile
        await renamedSymbolItem.click();

        await expect(iframe.getByText(/Decompiling custom_init_func\.\.\./)).toBeVisible({ timeout: 10000 });
        await expect(iframe.getByText('Decompilation complete.')).toBeVisible({ timeout: 60000 });

        const editor = iframe.locator('.ace_content');
        await expect(editor).toContainText('custom_init_func');

        // Test Variable Renaming: rename pcRam0000000000003fe0 to my_custom_param
        await iframe.locator('.toolbar-rename-var-btn').click();
        await expect(iframe.locator('.rename-input')).toBeVisible();

        await iframe.locator('.rename-old-var-input').fill('pcRam0000000000003fe0');
        await iframe.locator('.rename-input').fill('my_custom_param');
        await iframe.locator('.confirm-rename-btn').click();

        // Verify code contains my_custom_param
        await expect(editor).toContainText('my_custom_param');

        // Check iframe window.localStorage for saved mapping
        const storedRenames = await iframe.evaluate(() => {
            return window.localStorage.getItem('ghidra_rename_mappings');
        });
        expect(storedRenames).not.toBeNull();
        expect(storedRenames).toContain('custom_init_func');
        expect(storedRenames).toContain('my_custom_param');
    });

    test('should extract symbols from .gnu_debugdata in Ghidra', async ({ page }) => {
        test.setTimeout(120000);

        const fixturePath = path.resolve('ghidra/example/libcodec2.so');
        const buffer = fs.readFileSync(fixturePath);

        const iframe = await runHandlerTest(page, {
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
