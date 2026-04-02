import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

/**
 * Integration test for the SETools SELinux policy analyzer.
 */
test('SETools handler loads and parses example policy', async ({ page }) => {
    // The fixture is a real SELinux binary policy from an Android device
    const fixturePath = path.join(__dirname, '..', '..', 'setools', 'example', 'policy');
    expect(fs.existsSync(fixturePath), `Sepolicy fixture not found at ${fixturePath}`).toBe(true);
    const buffer = fs.readFileSync(fixturePath);

    const iframe = await runHandlerTest(page, {
        handler: 'setools',
        file: {
            content: buffer,
            name: 'sepolicy',
            type: 'application/octet-stream'
        }
    });

    // Verify UI header and analysis method
    await expect(iframe.locator('h2')).toContainText('SETools', { timeout: 30000 });

    // Verify policy version and symbol counts from the binary
    await expect(iframe.locator('body')).toContainText('Version: 30');

    // Verify "Allow" tab shows resolved permissions.
    await iframe.getByRole('tab', { name: /Allow \(/ }).click();
    await iframe.getByPlaceholder(/Search symbols or rules/).fill('dumpstate');
    await expect(iframe.locator('body')).toContainText('allow dumpstate uce_service:service_manager { find };');

    // Test Regex Search
    await iframe.getByLabel('Regex').check();
    await iframe.getByPlaceholder(/Search symbols or rules/).fill('^dump.*e$');
    await expect(iframe.locator('body')).toContainText('allow dumpstate');

    // Verify regex matches multiple things but filtered by pattern
    await iframe.getByPlaceholder(/Search symbols or rules/).fill('dumpstate|surfaceflinger');
    await expect(iframe.locator('body')).toContainText('allow dumpstate');
    await expect(iframe.locator('body')).toContainText('allow surfaceflinger');

    // Test Regex for symbols
    await iframe.getByRole('tab', { name: /Types \(/ }).click();
    await iframe.getByPlaceholder(/Search symbols or rules/).fill('^shell$');
    await expect(iframe.locator('body')).toContainText('shell');
    await expect(iframe.locator('body')).not.toContainText('adbd_shell'); // Should be excluded by ^ and $
});
