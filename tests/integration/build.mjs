#!/usr/bin/env node
import { mkdirSync, copyFileSync, existsSync, cpSync } from 'fs';
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

async function copyFixtures() {
    const srcFixtures = 'tests/fixtures';
    const destFixtures = 'dist/tests/fixtures';
    if (!existsSync(srcFixtures)) {
        return;
    }
    cpSync(srcFixtures, destFixtures, { recursive: true });
}

async function buildIntegrationTests() {
    const dest = 'dist/tests/integration';
    mkdirSync(dest, { recursive: true });

    await Promise.all([buildDriver(), copyDriverHtml(), copyFixtures()]);
}

buildIntegrationTests();
