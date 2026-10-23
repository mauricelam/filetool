import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';

const isDev = process.env.BUILD_MODE === 'dev';

await esbuild.build({
    entryPoints: ['main.tsx', 'worker.ts'],
    bundle: true,
    outdir: '../dist/disk-viewer',
    platform: 'browser',
    plugins: [
        rustWasm({
            projectDir: 'disk-wasm',
            outName: 'disk-wasm',
            watchPaths: ['src/**/*.rs']
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
