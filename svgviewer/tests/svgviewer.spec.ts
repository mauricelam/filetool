import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '../../tests/integration/test-utils.ts';

test('SVG Viewer should load and display SVG', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../testdata/test.svg');
    const fileContent = fs.readFileSync(filePath);

    const iframe = await runHandlerTest(page, {
        handler: 'svgviewer',
        file: {
            content: fileContent,
            name: 'test.svg',
            type: 'image/svg+xml'
        }
    });

    // Check if the circle is rendered in the viewer area (not the navigation/miniature)
    // We can assume the first one is the main viewer's element
    await expect(iframe.locator('circle').first()).toBeVisible();

    // Check if the download button is present
    await expect(iframe.getByRole('button', { name: 'Download PNG' })).toBeVisible();
});
