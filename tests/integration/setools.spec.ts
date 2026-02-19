import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';

test('SETools handler loads and parses minimal sepolicy', async ({ page }) => {
    // Create a minimal sepolicy file with types and datums
    // magic(4), sig_len(4), version(4), config(4), counts(32) = 48 bytes
    const buffer = new Uint8Array(48 + 4 + 6 + 16 + 4 + 6 + 16); // Header + 2 types
    const view = new DataView(buffer.buffer);
    view.setUint32(0, 0xf97cff86, true); // Magic
    view.setUint32(4, 0, true);          // Signature length
    view.setUint32(8, 30, true);         // Version
    view.setUint32(12, 0, true);         // Config

    // Counts: commons(0), classes(0), roles(0), types(2), ...
    view.setUint32(16, 0, true);
    view.setUint32(20, 0, true);
    view.setUint32(24, 0, true);
    view.setUint32(28, 2, true);
    view.setUint32(32, 0, true);
    view.setUint32(36, 0, true);
    view.setUint32(40, 0, true);
    view.setUint32(44, 0, true);

    let offset = 48;
    // Type 1: "type_a"
    view.setUint32(offset, 6, true); offset += 4;
    new TextEncoder().encodeInto("type_a", new Uint8Array(buffer.buffer, offset, 6)); offset += 6;
    // datum (16 bytes for v30: value, primary, flavor, flags)
    view.setUint32(offset, 1, true); offset += 4;
    view.setUint32(offset, 1, true); offset += 4;
    view.setUint32(offset, 1, true); offset += 4;
    view.setUint32(offset, 0, true); offset += 4;

    // Type 2: "type_b"
    view.setUint32(offset, 6, true); offset += 4;
    new TextEncoder().encodeInto("type_b", new Uint8Array(buffer.buffer, offset, 6)); offset += 6;
    // datum
    view.setUint32(offset, 2, true); offset += 4;
    view.setUint32(offset, 2, true); offset += 4;
    view.setUint32(offset, 1, true); offset += 4;
    view.setUint32(offset, 0, true); offset += 4;

    const iframe = await runHandlerTest(page, {
        handler: 'setools',
        file: {
            content: buffer,
            name: 'sepolicy',
            type: 'application/octet-stream'
        }
    });

    // Wait for Pyodide and parsing
    await expect(iframe.locator('h1')).toContainText('SETools - Sepolicy Analyzer', { timeout: 30000 });
    await expect(iframe.locator('body')).toContainText('Version: 30');
    await expect(iframe.locator('body')).toContainText('Types (2)');
});
