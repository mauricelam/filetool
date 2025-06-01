import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const isDev = process.env.BUILD_MODE === 'dev';

// Build the main bundle
await esbuild.build({
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/jqviewer',
    platform: 'browser',
    external: ['fs', 'path', 'crypto'],
    inject: ['./node-shims.js'],
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
    target: ['es2020'],
    format: 'esm',
    define: {
        'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    }
});

// Build the worker bundle
await esbuild.build({
    entryPoints: ['jq.worker.ts'],
    bundle: true,
    outdir: '../dist/jqviewer',
    platform: 'browser',
    external: ['fs', 'path', 'crypto'],
    inject: ['./node-shims.js'],
    sourcemap: isDev,
    minify: !isDev,
    target: ['es2020'],
    format: 'esm',
    define: {
        'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    }
});
