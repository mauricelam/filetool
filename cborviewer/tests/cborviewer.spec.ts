import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '../../tests/fixtures.js';

import { runHandlerTest, HandlerTestOptions } from '@filetool/integration-test-harness';

test.describe('cborviewer handler', () => {
    let validFile: HandlerTestOptions['file'];
    let invalidFile: HandlerTestOptions['file'];

    test.beforeAll(async () => {
        const validFilePath = path.join(__dirname, '..', '..', 'cborviewer', 'example', 'test.cbor');
        const validContent = await fs.readFile(validFilePath);
        validFile = {
            content: validContent,
            name: 'test.cbor',
            type: 'application/cbor'
        };

        invalidFile = {
            content: Buffer.from('this is not cbor'),
            name: 'invalid.cbor',
            type: 'application/cbor'
        };
    });

    test('should display default diagnostic view', async ({ page }) => {
        // skipOffline: true because cborviewer WASM module loads lazily when file processing begins
        const iframe = await runHandlerTest(page, {
            handler: 'cborviewer',
            file: validFile,
            skipOffline: true,
        });
        await expect(iframe.locator('body')).toContainText('{"hello": "world"}');
    });

    test('should switch to verbose view', async ({ page }) => {
        // skipOffline: true because cborviewer WASM module loads lazily when file processing begins
        const iframe = await runHandlerTest(page, {
            handler: 'cborviewer',
            file: validFile,
            skipOffline: true,
        });
        await iframe.click('text=Verbose');
        await expect(iframe.locator('body')).toContainText('map(1)');
    });

    test('should display an error for an invalid file', async ({ page }) => {
        // skipOffline: true because cborviewer WASM module loads lazily when file processing begins
        const iframe = await runHandlerTest(page, {
            handler: 'cborviewer',
            file: invalidFile,
            skipOffline: true,
        });
        await expect(iframe.locator('body')).toContainText('Error');
    });
});
