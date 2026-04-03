import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('should correctly show binary diff between two binary files', async ({ page }) => {
    // Create binary buffers with null bytes to trigger binary mode
    const buf1 = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
    const buf2 = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x42, 0x69, 0x6e, 0x61, 0x72, 0x79]);

    const iframe = await runHandlerTest(page, {
        handler: 'diffviewer',
        file: {
            content: buf1,
            name: 'bin1.dat',
            type: 'application/octet-stream'
        },
        additionalFiles: [{
            content: buf2,
            name: 'bin2.dat',
            type: 'application/octet-stream'
        }]
    });

    await expect(iframe.getByText(/Diffing: bin1\.dat vs bin2\.dat/)).toBeVisible({ timeout: 20000 });

    // Verify binary mode is active
    const binaryButton = iframe.getByRole('button', { name: 'Binary' });
    await expect(binaryButton).toBeVisible({ timeout: 10000 });
    // It should be active (#666)
    await expect(binaryButton).toHaveCSS('background-color', 'rgb(102, 102, 102)');

    // Check for some diff content (hex values)
    await expect(iframe.locator('span', { hasText: '57' }).first()).toBeVisible({ timeout: 10000 }); // W
    await expect(iframe.locator('span', { hasText: '42' }).first()).toBeVisible({ timeout: 10000 }); // B
});

