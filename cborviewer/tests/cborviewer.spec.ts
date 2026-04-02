import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';

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
        const iframe = await runHandlerTest(page, {
            handler: 'cborviewer',
            file: validFile,
        });
        await expect(iframe.locator('body')).toContainText('{"hello": "world"}');
    });

    test('should switch to verbose view', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'cborviewer',
            file: validFile,
        });
        await iframe.click('text=Verbose');
        await expect(iframe.locator('body')).toContainText('map(1)');
    });

    test('should display an error for an invalid file', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'cborviewer',
            file: invalidFile,
        });
        await expect(iframe.locator('body')).toContainText('Error');
    });
});
