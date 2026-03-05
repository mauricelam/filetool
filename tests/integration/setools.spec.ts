import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';
import * as fs from 'fs';
import * as path from 'path';

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
    await expect(iframe.locator('h1')).toContainText('SETools - Sepolicy Analyzer (WASM)', { timeout: 30000 });

    // Verify policy version and symbol counts from the binary
    await expect(iframe.locator('body')).toContainText('Version: 30');

    // Check for some common Android SELinux types that should be in the example policy.
    // They might not be in the first 1000 allow rules, so we check the Types tab and use search.
    await iframe.getByRole('tab', { name: /Types/ }).click();
    await iframe.getByPlaceholder(/Search symbols or rules/).fill('untrusted_app');
    await expect(iframe.locator('body')).toContainText('untrusted_app');

    await iframe.getByPlaceholder(/Search symbols or rules/).fill('system_server');
    await expect(iframe.locator('body')).toContainText('system_server');
});
