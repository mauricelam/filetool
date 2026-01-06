import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const isDev = process.env.BUILD_MODE === 'dev';

const SETTINGS = {
    entryPoints: ['main.tsx', 'jq.worker.ts'],
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
};

if (process.env['BUILD_MODE'] === 'dev') {
    const ctx = await esbuild.context({
        ...SETTINGS,
        sourcemap: true,
    });
    await ctx.watch();
} else {
    await esbuild.build({ ...SETTINGS, minify: true });
}
