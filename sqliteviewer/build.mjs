import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const isDev = process.env.BUILD_MODE === 'dev';

// Build the main bundle
await esbuild.build({
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/sqliteviewer',
    platform: 'browser',
    plugins: [
        copy({
            assets: [
                {
                    from: './index.html',
                    to: 'index.html'
                },
                {
                    from: './node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm',
                    to: 'jswasm/sqlite3.wasm'
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
    entryPoints: ['sqlite.worker.ts'],
    bundle: true,
    outdir: '../dist/sqliteviewer',
    platform: 'browser',
    sourcemap: isDev,
    minify: !isDev,
    target: ['es2022'],
    format: 'esm',
    define: {
        'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    }
});