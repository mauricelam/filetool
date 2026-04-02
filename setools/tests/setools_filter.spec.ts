import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('SETools allow rules tab filters when search term changes', async ({ page }) => {
    const fixturePath = path.join(__dirname, '..', '..', 'setools', 'example', 'policy');
    const buffer = fs.readFileSync(fixturePath);

    const iframe = await runHandlerTest(page, {
        handler: 'setools',
        file: {
            content: buffer,
            name: 'sepolicy',
            type: 'application/octet-stream'
        }
    });

    await expect(iframe.locator('h2')).toContainText('SETools', { timeout: 30000 });

    // Initial rules count (should be all or a lot)
    let initialCount = 0;
    await expect(async () => {
        const initialRulesText = await iframe.getByRole('tab', { name: /^Allow \(/ }).textContent();
        initialCount = parseInt(initialRulesText?.match(/\((\d+)\)/)?.[1] || '0');
        expect(initialCount).toBeGreaterThan(0);
    }).toPass({ timeout: 15000 });

    console.log(`Initial rules count: ${initialCount}`);

    // Search for something specific
    const searchInput = iframe.getByPlaceholder(/Search symbols or rules/);
    await searchInput.fill('untrusted_app');

    // Wait for the count to change
    let filteredCount = 0;
    await expect(async () => {
        const rulesText = await iframe.getByRole('tab', { name: /^Allow \(/ }).textContent();
        filteredCount = parseInt(rulesText?.match(/\((\d+)\)/)?.[1] || '0');
        expect(filteredCount).toBeLessThan(initialCount);
        expect(filteredCount).toBeGreaterThan(0);
    }).toPass();

    console.log(`Filtered count for 'untrusted_app': ${filteredCount}`);

    // Now test a short search term (2 chars)
    await searchInput.fill('un');

    // We expect the count to increase from filteredCount because 'un' matches more than 'untrusted_app'
    // but should still be less than initialCount
    await expect(async () => {
        const currentRulesText = await iframe.getByRole('tab', { name: /^Allow \(/ }).textContent();
        const currentCount = parseInt(currentRulesText?.match(/\((\d+)\)/)?.[1] || '0');
        console.log(`Current count for 'un': ${currentCount}`);
        expect(currentCount).toBeGreaterThan(filteredCount);
        expect(currentCount).toBeLessThan(initialCount);
    }).toPass({ timeout: 15000 });
});
