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

        // Minimal valid BFBS
        const bfbsData = Buffer.alloc(64);
        bfbsData.writeInt32LE(12, 0); // Root offset to Schema table at 12
        bfbsData.write('BFBS', 4);     // Identifier
        // Schema VTable at 8
        bfbsData.writeUInt16LE(8, 8);  // vtable size
        bfbsData.writeUInt16LE(20, 10); // table size
        bfbsData.writeUInt16LE(4, 12);  // objects vector offset
        bfbsData.writeUInt16LE(8, 14);  // enums vector offset
        // Schema Table at 12
        bfbsData.writeInt32LE(4, 12);  // Points back to VTable at 8 (12-4=8)
        bfbsData.writeInt32LE(8, 16);  // objects vector at 12+8=20
        bfbsData.writeInt32LE(12, 20); // enums vector at 12+12=24
        // objects vector at 20 (12+8)
        bfbsData.writeInt32LE(0, 20);  // length 0
        // enums vector at 24 (12+12)
        bfbsData.writeInt32LE(0, 24);  // length 0

        bfbsFile = {
            content: bfbsData,
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
        await expect(iframe.locator('body')).toContainText('objects');
        await expect(iframe.locator('body')).toContainText('enums');
    });

    test('should display data file info and identifier', async ({ page }) => {
        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: dataFile,
        });
        await iframe.click('text=Raw Stats');
        await expect(iframe.locator('body')).toContainText('TEST');
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
        await expect(iframe.locator('body')).toContainText('Root Table Offset');
    });

    test('should display extended view', async ({ page }) => {
        const fbData = Buffer.alloc(32);
        fbData.writeInt32LE(12, 0);
        fbData.writeUInt16LE(6, 4);
        fbData.writeUInt16LE(8, 6);
        fbData.writeUInt16LE(4, 8);
        fbData.writeInt32LE(8, 12);
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
        await iframe.click('text=Extended View');
        await expect(iframe.locator('body')).toContainText('32-bit soffset to vtable location');
    });

    test('should display real fixture (.fbs)', async ({ page }) => {
        const filePath = path.resolve(__dirname, '../../flatbuffers/example/monster.fbs');
        const content = await fs.readFile(filePath);
        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: {
                content,
                name: 'monster.fbs',
                type: ''
            },
        });
        await expect(iframe.locator('body')).toContainText('table Monster');
        await expect(iframe.locator('body')).toContainText('health:int');
    });

    test('should display real fixture (.bin)', async ({ page }) => {
        const filePath = path.resolve(__dirname, '../../flatbuffers/example/monster.bin');
        const content = await fs.readFile(filePath);
        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: {
                content,
                name: 'monster.bin',
                type: ''
            },
        });
        await expect(iframe.locator('body')).toContainText('Root Table Offset');
        await expect(iframe.locator('body')).toContainText('Root Table');
    });

    test('should display real fixture (.bfbs)', async ({ page }) => {
        const filePath = path.resolve(__dirname, '../../flatbuffers/example/monster.bfbs');
        const content = await fs.readFile(filePath);
        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: {
                content,
                name: 'monster.bfbs',
                type: ''
            },
        });
        await expect(iframe.locator('body')).toContainText('objects');
        await expect(iframe.locator('body')).toContainText('Monster');
    });

    test('should decode real fixture (.bin) with uploaded schema (.bfbs)', async ({ page }) => {
        const binPath = path.resolve(__dirname, '../../flatbuffers/example/monster.bin');
        const bfbsPath = path.resolve(__dirname, '../../flatbuffers/example/monster.bfbs');
        const binContent = await fs.readFile(binPath);
        const bfbsContent = await fs.readFile(bfbsPath);

        const iframe = await runHandlerTest(page, {
            handler: 'flatbuffers',
            file: {
                content: binContent,
                name: 'monster.bin',
                type: ''
            },
        });

        // Upload schema
        const fileChooserPromise = page.waitForEvent('filechooser');
        await iframe.locator('text=Drop .bfbs schema here').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
            name: 'monster.bfbs',
            buffer: bfbsContent,
            mimeType: 'application/octet-stream'
        });

        await expect(iframe.locator('body')).toContainText('Gorgon');
        await expect(iframe.locator('body')).toContainText('Gorgon');
        await expect(iframe.locator('body')).toContainText('300'); // health
    });
});

test('should detect FlatBuffers file in main UI', async ({ page }) => {
    await page.goto('./');

    // Wait for the drop target to be ready
    const dropTarget = page.locator('#droptarget');
    await expect(dropTarget).toBeVisible({ timeout: 15000 });

    // Dispatch the 'openFiles' event with a mock .fb file
    await page.evaluate(() => {
        const fbData = new Uint8Array([0, 0, 0, 0, 0x54, 0x45, 0x53, 0x54]); // Dummy data with ID 'TEST'
        const file = new File([fbData], 'test.fb', { type: 'application/octet-stream' });
        // Use the event name 'openFiles' which is handled in App.tsx
        window.dispatchEvent(new CustomEvent('openFiles', { detail: [file] }));
    });

    // Check that the file is displayed
    await expect(page.locator('.filename')).toHaveText('test.fb');

    // Check that the FlatBuffers handler is offered
    const fbButton = page.getByRole('button', { name: 'FlatBuffers' });
    await expect(fbButton).toBeVisible({ timeout: 10000 });

    // Click it to open
    await fbButton.click();

    // Check that the FlatBuffers Viewer is opened in the iframe
    const iframeLocator = page.locator('#framecontainer iframe');
    await expect(iframeLocator).toBeVisible();

    const iframe = page.frameLocator('#framecontainer iframe');
    await expect(iframe.locator('body')).toContainText('FlatBuffers Viewer - test.fb');
    await iframe.locator('text=Raw Stats').click();
    await expect(iframe.locator('body')).toContainText('TEST');
});
