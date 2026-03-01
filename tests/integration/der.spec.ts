import { test, expect } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

import { runHandlerTest, HandlerTestOptions } from './test-utils';

test.describe('der handler', () => {
    let validFile: HandlerTestOptions['file'];

    test.beforeAll(async () => {
        const validFilePath = path.join(__dirname, '..', 'fixtures', 'test.der');
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
