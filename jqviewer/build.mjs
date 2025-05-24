import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { wasmLoader } from 'esbuild-plugin-wasm';
import process from 'process';

const isDev = process.env.BUILD_MODE === 'dev';

const ctx = await esbuild.context({
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/jqviewer',
    format: 'esm',
    target: ['es2020'],
    platform: 'browser',
    loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
    },
    plugins: [
        wasmLoader(),
        copy({
            assets: [
                {
                    from: 'index.html',
                    to: 'index.html',
                    watch: isDev,
                },
            ],
        }),
    ],
    // Handle Node.js built-in modules
    external: ['fs', 'path', 'crypto'],
    inject: ['./node-shims.js'],
});

if (isDev) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    await ctx.dispose();
}
