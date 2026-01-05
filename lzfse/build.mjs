
import esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const SETTINGS = {
    entryPoints: ['main.tsx', 'worker.ts'],
    outdir: "../dist/lzfse",
    bundle: true,
    format: "esm",
    platform: "browser",
    plugins: [
        copy({
            assets: [
                {
                    from: './index.html',
                    to: 'index.html',
                    watch: process.env['BUILD_MODE'] === 'dev',
                },
                {
                    from: './lzfse.wasm',
                    to: 'lzfse.wasm',
                    watch: process.env['BUILD_MODE'] === 'dev',
                },
                {
                    from: './lzfse.js',
                    to: 'lzfse.js',
                    watch: process.env['BUILD_MODE'] === 'dev',
                },
            ],
        }),
    ],
    loader: {
        '.tsx': 'tsx',
        '.css': 'css',
    }
}

if (process.env['BUILD_MODE'] === 'dev') {
    const ctx = await esbuild.context({
        ...SETTINGS,
        sourcemap: true,
    });
    await ctx.watch();
} else {
    await esbuild.build({ ...SETTINGS, minify: true });
}

