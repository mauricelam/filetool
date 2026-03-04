import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Integration test for the SETools SELinux policy analyzer.
 *
 * NOTE: This test is expected to FAIL in environments without a perfectly valid
 * SELinux binary policy fixture. libsepol is very strict about the binary format.
 * The current fixture is a minimal attempt at a binary policy.
 *
 * To fix: Replace tests/fixtures/setools/minimal_sepolicy.bin with a real
 * sepolicy file (e.g. from an Android device or a Linux system).
 */
test('SETools handler loads and parses minimal sepolicy', async ({ page }) => {
    // The fixture is a hand-crafted minimal SELinux binary policy
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'setools', 'minimal_sepolicy.bin');
    expect(fs.existsSync(fixturePath), `Minimal sepolicy fixture not found at ${fixturePath}`).toBe(true);
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
    // We expect the WASM-based analyzer to display its name correctly
    await expect(iframe.locator('h1')).toContainText('SETools - Sepolicy Analyzer (WASM)', { timeout: 30000 });

    // Verify policy version and symbol counts from the minimal binary
    await expect(iframe.locator('body')).toContainText('Version: 30');
    await expect(iframe.locator('body')).toContainText('Types (2)');

    // Verify symbol names extracted from the binary fixture
    await expect(iframe.locator('body')).toContainText('type_a');
    await expect(iframe.locator('body')).toContainText('type_b');
});
