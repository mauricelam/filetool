#!/usr/bin/env node
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import esbuild from 'esbuild';

async function buildDriver() {
    await esbuild.build({
        entryPoints: ['tests/integration/driver.ts'],
        outfile: 'dist/tests/integration/driver.js',
        bundle: true,
    });
}

async function copyDriverHtml() {
    const srcDriverHtml = 'tests/integration/driver.html';
    const destDriverHtml = 'dist/tests/integration/driver.html';
    if (!existsSync(srcDriverHtml)) {
        throw new Error(`Missing ${srcDriverHtml}`);
    }
    copyFileSync(srcDriverHtml, destDriverHtml);
}

async function buildIntegrationTests() {
    const dest = 'dist/tests/integration';
    mkdirSync(dest, { recursive: true });

    await Promise.all([buildDriver(), copyDriverHtml()]);
}

buildIntegrationTests();
