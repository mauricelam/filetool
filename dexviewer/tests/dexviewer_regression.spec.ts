import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

function computeAdler32(buf: Buffer, offset: number = 12): number {
    let a = 1;
    let b = 0;
    const MOD = 65521;
    for (let i = offset; i < buf.length; i++) {
        a = (a + buf[i]) % MOD;
        b = (b + a) % MOD;
    }
    return ((b << 16) | a) >>> 0;
}

test.describe('DEX Viewer Regression Tests', () => {
    test('should open DEX file with data_size zeroed (map_off outside data_section)', async ({ page }) => {
        test.setTimeout(180000);
        const dexPath = path.join(__dirname, '..', '..', 'dexviewer', 'dex-parser', 'resources', 'classes.dex');
        const fileContent = Buffer.from(fs.readFileSync(dexPath));

        // Zero out data_size at offset 104..107 (uint32)
        fileContent.writeUInt32LE(0, 104);

        // Recalculate Adler32 checksum over fileContent[12..] and update at offset 8..11
        const checksum = computeAdler32(fileContent, 12);
        fileContent.writeUInt32LE(checksum, 8);

        const iframe = await runHandlerTest(page, {
            handler: 'dexviewer',
            file: {
                content: fileContent,
                name: 'classes.dex',
                type: 'application/octet-stream'
            }
        });

        // The package tree should load successfully without throwing "map_list not in data section"
        await expect(iframe.locator('.package-tree')).toBeVisible({ timeout: 60000 });

        // Check that package nodes or classes are present
        const packageNodes = iframe.locator('.package-node');
        await expect(packageNodes.first()).toBeVisible({ timeout: 30000 });
    });
});
