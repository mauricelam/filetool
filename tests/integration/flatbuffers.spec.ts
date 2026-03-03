import { test, expect } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

import { runHandlerTest, HandlerTestOptions } from './test-utils';

test.describe('flatbuffers handler', () => {
    let fbsFile: HandlerTestOptions['file'];
    let bfbsFile: HandlerTestOptions['file'];
    let dataFile: HandlerTestOptions['file'];

    test.beforeAll(async () => {
        fbsFile = {
            content: Buffer.from('namespace MyGame;\ntable Monster { name:string; }'),
            name: 'test.fbs',
            type: ''
        };

        bfbsFile = {
            content: Buffer.from([0, 0, 0, 0, 0x42, 0x46, 0x42, 0x53, 0, 0, 0, 0]), // Dummy BFBS
            name: 'test.bfbs',
            type: ''
        };

        dataFile = {
            content: Buffer.from([0x00, 0x00, 0x00, 0x00, 0x54, 0x45, 0x53, 0x54, 0x00, 0x00]), // Dummy data with ID 'TEST'
            name: 'test.fb',
            type: ''
        };
    });

    test('should display text schema (.fbs)', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: fbsFile,
        });
        await expect(iframe.locator('body')).toContainText('Monster');
    });

    test('should display binary schema (.bfbs) info', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: bfbsFile,
        });
        await expect(iframe.locator('body')).toContainText('binary FlatBuffers schema');
    });

    test('should display data file info and identifier', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: dataFile,
        });
        await expect(iframe.locator('body')).toContainText('TEST');
    });
});
