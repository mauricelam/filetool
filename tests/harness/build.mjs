#!/usr/bin/env node
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import esbuild from 'esbuild';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildDriver() {
    await esbuild.build({
        entryPoints: [path.join(__dirname, 'driver.ts')],
        outfile: path.join(__dirname, '../../dist/tests/integration/driver.js'),
        bundle: true,
    });
}

async function copyDriverHtml() {
    const srcDriverHtml = path.join(__dirname, 'driver.html');
    const destDriverHtml = path.join(__dirname, '../../dist/tests/integration/driver.html');
    if (!existsSync(srcDriverHtml)) {
        throw new Error(`Missing ${srcDriverHtml}`);
    }
    copyFileSync(srcDriverHtml, destDriverHtml);
}

async function buildIntegrationTests() {
    const dest = path.join(__dirname, '../../dist/tests/integration');
    mkdirSync(dest, { recursive: true });

    await Promise.all([buildDriver(), copyDriverHtml()]);
}

buildIntegrationTests();
