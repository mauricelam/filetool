
import esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { execSync } from 'child_process';

execSync('npm run build --prefix lzfse-wasm', { stdio: 'inherit' });

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
                    from: './lzfse-wasm/pkg/lzfse_wasm_bg.wasm',
                    to: 'lzfse_wasm_bg.wasm',
                    watch: process.env['BUILD_MODE'] === 'dev',
                },
                {
                    from: './lzfse-wasm/pkg/lzfse_wasm.js',
                    to: 'lzfse_wasm.js',
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

