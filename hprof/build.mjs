import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';

const isDev = process.env.BUILD_MODE === 'dev';

// Build the main bundle
await esbuild.build({
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/hprof',
    platform: 'browser',
    plugins: [
        rustWasm({
            projectDir: 'hprof-wasm',
            outName: 'hprof-wasm',
            watchPaths: [
                'src/**/*.rs',
                'Cargo.toml',
            ]
        }),
        copy({
            assets: [
                {
                    from: './index.html',
                    to: 'index.html'
                },
                {
                    from: './test.hprof',
                    to: 'test.hprof'
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
