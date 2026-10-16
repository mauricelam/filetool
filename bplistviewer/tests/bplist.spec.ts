import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('BplistViewer should display the content of a binary plist file', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/sample1.bplist');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'bplistviewer',
        file: {
            content: fileContent,
            name: 'sample1.bplist',
            type: 'application/x-plist'
        }
    });

    await expect(iframe.locator('text="CFBundleIdentifier"')).toBeVisible();
    await expect(iframe.locator('text=com.apple.dictionary.MySample')).toBeVisible();
});

test('BplistViewer should allow opening binary plist as text plist', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/sample1.bplist');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'bplistviewer',
        file: {
            content: fileContent,
            name: 'sample1.bplist',
            type: 'application/x-plist'
        }
    });

    // Setup listener for openFile message sent from iframe
    const openFileMessagePromise = page.evaluate(() => {
        return new Promise<any>((resolve) => {
            const handler = (e: MessageEvent) => {
                if (e.data && e.data.action === 'openFile') {
                    window.removeEventListener('message', handler);
                    resolve({
                        action: e.data.action,
                        fileName: e.data.file ? e.data.file.name : null,
                        fileType: e.data.file ? e.data.file.type : null
                    });
                }
            };
            window.addEventListener('message', handler);
        });
    });

    const openBtn = iframe.locator('button:has-text("Open as Text Plist")');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const msg = await openFileMessagePromise;
    expect(msg.action).toBe('openFile');
    expect(msg.fileName).toBe('sample1.plist');
});

test('BplistViewer should allow downloading binary plist as text plist', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/sample1.bplist');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'bplistviewer',
        file: {
            content: fileContent,
            name: 'sample1.bplist',
            type: 'application/x-plist'
        }
    });

    const downloadBtn = iframe.locator('button:has-text("Download as Text Plist")');
    await expect(downloadBtn).toBeVisible();

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadBtn.click()
    ]);

    expect(download.suggestedFilename()).toBe('sample1.plist');

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const downloadedContent = fs.readFileSync(downloadPath!, 'utf-8');
    expect(downloadedContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(downloadedContent).toContain('<!DOCTYPE plist PUBLIC');
    expect(downloadedContent).toContain('<key>CFBundleIdentifier</key>');
    expect(downloadedContent).toContain('<string>com.apple.dictionary.MySample</string>');
});
