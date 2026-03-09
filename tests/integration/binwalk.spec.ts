import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test('binwalk identifies an ELF file', async ({ page }) => {
    await page.goto('http://localhost:8080/filetool/binwalk/index.html');

    // Create a simple ELF header to trigger a signature match
    // \x7FELF, class=2 (64-bit), endian=1 (little), version=1, osabi=0, abiversion=0, padding=0
    // followed by type=2 (executable), machine=62 (x86-64), version=1
    const elfHeader = Buffer.from([
        0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x3E, 0x00, 0x01, 0x00, 0x00, 0x00
    ]);

    await page.evaluate(async (data) => {
        const file = new File([new Uint8Array(data)], 'test.elf', { type: 'application/x-executable' });
        window.postMessage({ action: 'respondFile', file }, '*');
    }, Array.from(elfHeader));

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(1);

    const cells = rows.first().locator('td');
    await expect(cells.nth(2)).toHaveText('elf');
});
