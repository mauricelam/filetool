import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, expect } from '@playwright/test';
import { runHandlerTest } from '@filetool/integration-test-harness';

test('PDF Viewer should correctly render a PDF file using PDF.js', async ({ page }) => {
    const pdfPath = path.resolve(__dirname, '../example/test.pdf');
    if (!fs.existsSync(pdfPath)) {
        throw new Error(`Test PDF fixture not found at ${pdfPath}`);
    }
    const pdfBuffer = fs.readFileSync(pdfPath);

    const iframe = await runHandlerTest(page, {
        handler: 'pdfjs',
        file: {
            content: pdfBuffer,
            name: 'test.pdf',
            type: 'application/pdf'
        },
    });

    // Wait for the PDF to be loaded and at least one canvas to be rendered
    await iframe.waitForSelector('canvas', { state: 'visible', timeout: 30000 });

    const canvasCount = await iframe.locator('canvas').count();
    expect(canvasCount).toBeGreaterThan(0);
});
