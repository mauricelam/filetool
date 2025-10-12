import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import pkg from 'esbuild-plugin-wasm';
import process from 'process';

const { default: wasmPlugin } = pkg;

const isDev = process.env.BUILD_MODE === 'dev';

// Build the main bundle
await esbuild.build({
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/cborviewer',
    platform: 'browser',
    plugins: [
        copy({
            assets: [
                {
                    from: './index.html',
                    to: 'index.html'
                }
            ]
        })
    ],
    sourcemap: isDev,
    minify: !isDev,
    target: ['es2022'],
    format: 'esm',
    define: {
        'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    }
});

// Build the worker bundle
await esbuild.build({
    entryPoints: ['cbor.worker.ts'],
    bundle: true,
    outdir: '../dist/cborviewer',
    platform: 'browser',
    sourcemap: isDev,
    minify: !isDev,
    target: ['es2022'],
    format: 'esm',
    plugins: [wasmPlugin()],
    define: {
        'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    }
});