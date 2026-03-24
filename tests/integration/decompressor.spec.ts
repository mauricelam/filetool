
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { runHandlerTest } from './test-utils';

test.describe('Decompressor Handler', () => {
    test.slow();
    const testCases = [
        { file: 'test.lzfse', name: 'LZFSE', formatChip: 'LZFSE', expectedChunks: ['hello world', 'is a message'] },
        { file: 'test.gz', name: 'GZIP', formatChip: 'GZIP', expectedChunks: ['This is an gzip', 'compressed file'] },
        { file: 'test.xz', name: 'XZ', formatChip: 'XZ', expectedChunks: ['This is a xz', 'pressed file'] },
        { file: 'test.lzma', name: 'LZMA', formatChip: 'LZMA', expectedChunks: ['This is an lzma', 'compressed file'] },
        { file: 'test.br', name: 'Brotli', formatChip: 'Brotli', expectedChunks: ['This is a brotl', 'compressed fil'] },
        { file: 'test.zz', name: 'ZLIB', formatChip: 'ZLIB', expectedChunks: ['This is a zlib', 'pressed file'] },
        { file: 'test.bz2', name: 'BZIP2', formatChip: 'BZIP2', expectedChunks: ['This is a bzip2', 'compressed file'] },
    ];

    for (const { file, name, formatChip, expectedChunks } of testCases) {
        test(`should decompress a ${name} file and display the content`, async ({ page }) => {
            const filePath = path.join(__dirname, '../../decompressor/example', file);
            const fileBuffer = fs.readFileSync(filePath);
            const iframe = await runHandlerTest(page, {
                handler: 'decompressor',
                file: {
                    content: Uint8Array.from(fileBuffer),
                    name: file,
                    type: 'application/octet-stream'
                },
            });

            // Wait for decompression to complete by checking for the format chip
            await expect(iframe.getByText(formatChip, { exact: true })).toBeVisible({ timeout: 10000 });

            // Now there is a nested iframe for the actual handler
            const handlerIframe = await iframe.waitForSelector('iframe');
            const handlerFrame = await handlerIframe.contentFrame();
            await handlerFrame!.waitForLoadState('domcontentloaded');

            // Check for the decompressed content within the nested handler iframe
            // For text files, it will likely be the textviewer
            const content = await handlerFrame!.locator('body').textContent();
            for (const chunk of expectedChunks) {
                expect(content?.toLowerCase()).toContain(chunk.toLowerCase());
            }

            // Verify metadata is displayed in the decompressor (parent of the nested iframe)
            await expect(iframe.getByText('savings', { exact: false })).toBeVisible();
        });
    }

    test('should decompress a .tar.gz file and name it .tar', async ({ page }) => {
        const filePath = path.join(__dirname, '../../decompressor/example/test.gz');
        const fileBuffer = fs.readFileSync(filePath);
        const iframe = await runHandlerTest(page, {
            handler: 'decompressor',
            file: {
                content: Uint8Array.from(fileBuffer),
                name: 'test.tar.gz',
                type: 'application/octet-stream'
            },
        });

        // Wait for decompression to complete by checking for the format chip
        await expect(iframe.getByText('GZIP', { exact: true })).toBeVisible({ timeout: 10000 });

        // Verify the filename in the UI is test.tar
        await expect(iframe.getByText('test.tar', { exact: true })).toBeVisible();
    });

    test('should fallback to .decoded if extension is unknown', async ({ page }) => {
        const filePath = path.join(__dirname, '../../decompressor/example/test.gz');
        const fileBuffer = fs.readFileSync(filePath);
        const iframe = await runHandlerTest(page, {
            handler: 'decompressor',
            file: {
                content: Uint8Array.from(fileBuffer),
                name: 'test.unknown',
                type: 'application/octet-stream'
            },
        });

        // Wait for decompression to complete
        await expect(iframe.getByText('GZIP', { exact: true })).toBeVisible({ timeout: 10000 });

        // Verify the filename in the UI is test.unknown.decoded
        await expect(iframe.getByText('test.unknown.decoded', { exact: true })).toBeVisible();
    });
});
