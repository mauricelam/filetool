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
        await expect(iframe.locator('body')).toContainText('Structure (Schema-less)');
    });

    test('should display data file info and identifier', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: dataFile,
        });
        await expect(iframe.locator('body')).toContainText('TEST');
        await expect(iframe.locator('body')).toContainText('Structure (Schema-less)');
    });

    test('should display structural view for valid file', async ({ page }) => {
        // Create a more valid-looking FlatBuffer for structural view
        const fbData = Buffer.alloc(32);
        // Root offset at 0
        fbData.writeInt32LE(12, 0); // Root Table at offset 12

        // VTable at 4
        fbData.writeUInt16LE(6, 4);  // vtable size
        fbData.writeUInt16LE(8, 6);  // table size
        fbData.writeUInt16LE(4, 8);  // field 0 offset (relative to table start)

        // Table at 12
        fbData.writeInt32LE(8, 12); // Points back to VTable at 4 (12 - 8 = 4)

        // Field 0 at 16 (12 + 4)
        fbData.writeInt32LE(42, 16);

        const validFbFile = {
            content: fbData,
            name: 'valid.fb',
            type: ''
        };

        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: validFbFile,
        });
        await expect(iframe.locator('body')).toContainText('Structure (Schema-less)');
        await expect(iframe.locator('body')).toContainText('Root Table Offset');
    });
});
