import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';

import { runHandlerTest, HandlerTestOptions } from '../../tests/integration/test-utils.ts';

test.describe('binutils handler', () => {
    let file: HandlerTestOptions['file'];

    test.beforeAll(async () => {
        const filePath = path.join(__dirname, '..', '..', 'binutils', 'example', 'libhello.so');
        const content = await fs.readFile(filePath);
        file = {
            content,
            name: 'libhello.so',
            type: 'application/octet-stream'
        };
    });

    test('should display default objdump output', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'binutils',
            file,
        });
        await expect(iframe.locator('body')).toContainText('file format elf64-x86-64');
    });

    test('should switch to nm and display symbols', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'binutils',
            file,
        });
        await iframe.click('text=nm');
        await expect(iframe.locator('body')).toContainText('_init');
    });

    test('should use flags to change output', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'binutils',
            file,
        });

        // First check the default output
        await expect(iframe.locator('body')).toContainText('file format elf64-x86-64');

        // Now click a checkbox to change flags
        await iframe.click('text="-d: Disassemble"');

        // Check that the output has changed to include disassembly
        await expect(iframe.locator('body')).toContainText('Disassembly of section .init:');
    });
});
