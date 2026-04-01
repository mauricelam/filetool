import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { runHandlerTest } from './test-utils';

test('BplistViewer should display a warning for a truncated binary plist file', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../../bplistviewer/example/sample1.bplist');
    const fileContent = fs.readFileSync(filePath);

    // Truncate the file by removing some bytes from the middle, but keeping the header and trailer.
    // The check is: offsetTableOffset + numObjects * offsetSize > buffer.length - 32

    const trailerStart = fileContent.length - 32;
    // Remove bytes before the trailer to make the buffer shorter than what offsetTableEnd expects
    const truncatedContent = Buffer.concat([
        fileContent.slice(0, trailerStart - 2),
        fileContent.slice(trailerStart)
    ]);

    const iframe = await runHandlerTest(page, {
        handler: 'bplistviewer',
        file: {
            content: truncatedContent,
            name: 'truncated.bplist',
            type: 'application/x-plist'
        }
    });

    await expect(iframe.locator('text="Warning"')).toBeVisible();
    await expect(iframe.locator('text="Offset table extends beyond the trailer. File may be truncated."')).toBeVisible();
});

test('BplistViewer should display a warning for an invalid trailer format', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../../bplistviewer/example/sample1.bplist');
    const fileContent = Buffer.from(fs.readFileSync(filePath));

    // Corrupt the trailer (first 6 bytes should be null)
    const trailerStart = fileContent.length - 32;
    fileContent[trailerStart] = 0xFF;

    const iframe = await runHandlerTest(page, {
        handler: 'bplistviewer',
        file: {
            content: fileContent,
            name: 'corrupt_trailer.bplist',
            type: 'application/x-plist'
        }
    });

    await expect(iframe.locator('text="Warning"')).toBeVisible();
    await expect(iframe.locator('text="Trailer format is invalid (expected null bytes). File may be truncated or corrupted."')).toBeVisible();
});

test('BplistViewer should display error and warnings for a severely truncated file', async ({ page }) => {
    // A file that will trigger maxObjectCount exceeded because the offsetTableEnd check is bypassed or fails
    // Actually, let's just make it really short but with a valid header
    const fileContent = Buffer.from('bplist00' + 'A'.repeat(40));

    const iframe = await runHandlerTest(page, {
        handler: 'bplistviewer',
        file: {
            content: fileContent,
            name: 'short.bplist',
            type: 'application/x-plist'
        }
    });

    await expect(iframe.locator('text="Error"')).toBeVisible();
    // It should also show warnings if they were detected before the crash
    await expect(iframe.locator('text="Warning"')).toBeVisible();
});
