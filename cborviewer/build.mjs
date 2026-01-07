import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';

const isDev = process.env.BUILD_MODE === 'dev';

// Build the main bundle
await esbuild.build({
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/cborviewer',
    platform: 'browser',
    plugins: [
        rustWasm({
            projectDir: 'cbor-diag-wasm',
            outName: 'cbor-diag-wasm', // wasm-pack will add _bg to the .wasm file, so this becomes abxml_wrapper_bg.wasm and abxml_wrapper.js
            watchPaths: [ // Paths relative to projectDir (cbor-diag-wasm)
                'src/**/*.rs',
                'Cargo.toml',
            ]
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