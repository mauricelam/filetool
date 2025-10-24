import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';

const isDev = process.env.BUILD_MODE === 'dev';

await esbuild.build({
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/proguardviewer',
    platform: 'browser',
    external: ['./proguard-wasm.js'],
    plugins: [
        rustWasm({
            projectDir: 'proguard-wasm',
            outName: 'proguard-wasm',
        }),
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