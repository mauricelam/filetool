
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { runHandlerTest } from './test-utils';

test.describe('Decompressor Handler', () => {
    test.slow();
    const testCases = [
        { file: 'test.lzfse', name: 'LZFSE', expectedChunks: ['hello world', 'is a message'] },
        { file: 'test.gz', name: 'GZIP', expectedChunks: ['This is an gzip', 'compressed file'] },
        { file: 'test.xz', name: 'XZ', expectedChunks: ['This is a xz', 'pressed file'] },
        { file: 'test.lzma', name: 'LZMA', expectedChunks: ['This is an lzma', 'compressed file'] },
        { file: 'test.br', name: 'Brotli', expectedChunks: ['This is an brotl', 'compressed fil'] },
        { file: 'test.zz', name: 'ZLIB', expectedChunks: ['This is a zlib', 'pressed file'] },
    ];

    for (const { file, name, expectedChunks } of testCases) {
        test(`should decompress a ${name} file and display the content`, async ({ page }) => {
            const filePath = path.join(__dirname, '../../decompressor/example', file);
            const fileBuffer = fs.readFileSync(filePath);
            await runHandlerTest(page, {
                handler: 'decompressor',
                file: {
                    content: Uint8Array.from(fileBuffer),
                    name: file,
                    type: 'application/octet-stream'
                },
            });

            // Wait for the decompressor handler to be loaded in an iframe
            const iframe = await page.waitForSelector('iframe[src*="decompressor"]');
            const frame = await iframe.contentFrame();
            await frame!.waitForLoadState('domcontentloaded');

            // Wait for decompression to complete by checking for status or metadata
            // Increased timeout to 60s as WASM initialization and sequential format trial can be slow in CI
            await expect(frame!.locator('text=Decompression successful.')).toBeVisible({ timeout: 60000 });

            // Check for the decompressed content within the iframe
            const content = await frame!.locator('pre').textContent();
            for (const chunk of expectedChunks) {
                expect(content?.toLowerCase()).toContain(chunk.toLowerCase());
            }

            // Verify metadata is displayed (using exact matching to avoid ambiguity with "Decompressed")
            await expect(frame!.getByText('Compressed:', { exact: true })).toBeVisible();
            await expect(frame!.getByText('Decompressed:', { exact: true })).toBeVisible();
            await expect(frame!.getByText('Ratio:', { exact: true })).toBeVisible();
        });
    }
});
