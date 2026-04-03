import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('should show warning for large binary files', async ({ page }) => {
    const size = 11 * 1024 * 1024;
    const buf1 = new Uint8Array(size);
    const buf2 = new Uint8Array(size);
    buf1[0] = 0; // Trigger binary
    buf2[0] = 0;

    const iframe = await runHandlerTest(page, {
        handler: 'diffviewer',
        file: {
            content: buf1,
            name: 'large1.dat',
            type: 'application/octet-stream'
        },
        additionalFiles: [{
            content: buf2,
            name: 'large2.dat',
            type: 'application/octet-stream'
        }]
    });

    // Check for the large file warning
    await expect(iframe.getByText('Files are too large for binary diffing (max 10MB).')).toBeVisible({ timeout: 20000 });
});

test('should show warning for extremely large binary files', async ({ page }) => {
    const size = 11 * 1024 * 1024;
    const buf1 = new Uint8Array(size);
    const buf2 = new Uint8Array(size);
    buf1[0] = 0; // Trigger binary
    buf2[0] = 0;

    const iframe = await runHandlerTest(page, {
        handler: 'diffviewer',
        file: {
            content: buf1,
            name: 'extreme1.dat',
            type: 'application/octet-stream'
        },
        additionalFiles: [{
            content: buf2,
            name: 'extreme2.dat',
            type: 'application/octet-stream'
        }]
    });

    // Check for the extremely large file warning
    await expect(iframe.getByText('Files are too large for binary diffing (max 10MB).')).toBeVisible({ timeout: 20000 });
});

