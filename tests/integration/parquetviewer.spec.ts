import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';
import * as fs from 'fs/promises';
import * as path from 'path';

test.describe('parquetviewer handler', () => {
    test('should display an error for an invalid parquet file', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'parquetviewer',
            file: {
                content: Buffer.from('this is not a parquet file'),
                name: 'invalid.parquet',
                type: 'application/x-parquet'
            },
        });
        // Since we are using an invalid file, it should show an error message
        await expect(iframe.locator('body')).toContainText('Error');
    });

    test('should show empty message for empty data', async ({ page }) => {
        // PAR1 magic is needed to even start parsing in some cases,
        // but let's see how hyparquet handles just random crap.
        // Actually, if it's completely invalid it will probably throw.
        const iframe = await runHandlerTest(page, {
            handler: 'parquetviewer',
            file: {
                content: Buffer.from('PAR1'), // Invalid but has magic
                name: 'empty.parquet',
                type: 'application/x-parquet'
            },
        });
        await expect(iframe.locator('body')).toContainText('Error');
    });

    test('should correctly process and display the example parquet file', async ({ page }) => {
        const filePath = path.join(__dirname, '..', '..', 'parquetviewer', 'example', 'example.parquet');
        const content = await fs.readFile(filePath);

        const iframe = await runHandlerTest(page, {
            handler: 'parquetviewer',
            file: {
                content,
                name: 'example.parquet',
                type: 'application/octet-stream'
            },
        });

        // Increase timeout for processing and check for column headers from example.parquet
        await expect(iframe.locator('text=first_name')).toBeVisible({ timeout: 15000 });
        await expect(iframe.locator('text=last_name')).toBeVisible();
        await expect(iframe.locator('text=email')).toBeVisible();

        // Check for some data
        await expect(iframe.locator('body')).toContainText('Amanda');
        await expect(iframe.locator('body')).not.toContainText('Error');
    });
});
