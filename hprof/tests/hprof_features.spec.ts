import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

test('HPROF viewer should support static and force graph modes', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../example/test.hprof');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'hprof',
        file: {
            content: fileContent,
            name: 'test.hprof',
            type: ''
        }
    });

    // Wait for the loading to complete
    await expect(iframe.locator('h2')).toContainText('HPROF Viewer: test.hprof', { timeout: 15000 });

    // Test Reference Graph tab
    await iframe.getByRole('tab', { name: 'Reference Graph' }).click();

    // Check force mode (default)
    await expect(iframe.locator('select').first()).toHaveValue('force');
    // Force graph uses g.nodes
    await expect(iframe.locator('g.nodes')).toBeVisible({ timeout: 10000 });

    // Switch to static mode
    await iframe.locator('select').first().selectOption('static');
    // Graphviz adds polygons
    await expect(iframe.locator('svg').filter({ has: iframe.locator('polygon') }).first()).toBeVisible({ timeout: 20000 });
});
