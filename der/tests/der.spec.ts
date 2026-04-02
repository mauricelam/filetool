import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';

import { runHandlerTest, HandlerTestOptions } from '../../tests/integration/test-utils.ts';

test.describe('der handler', () => {
    let validFile: HandlerTestOptions['file'];

    test.beforeAll(async () => {
        const validFilePath = path.join(__dirname, '..', '..', 'der', 'example', 'test.der');
        const validContent = await fs.readFile(validFilePath);
        validFile = {
            content: validContent,
            name: 'test.der',
            type: 'application/x-x509-ca-cert'
        };
    });

    test('should display DER ASCII view', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'der',
            file: validFile,
        });

        // Wait for the viewer to render the output
        await expect(iframe.locator('body')).toContainText('SEQUENCE', { timeout: 10000 });
        await expect(iframe.locator('body')).toContainText('OBJECT_IDENTIFIER');
        await expect(iframe.locator('body')).toContainText('UTCTime');
    });
});
