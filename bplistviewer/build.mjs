import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const isDev = process.env.BUILD_MODE === 'dev';

const SETTINGS = {
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/bplistviewer',
    plugins: [
        copy({
            assets: [
                {
                    from: './index.html',
                    to: 'index.html',
                    watch: isDev,
                }
            ]
        })
    ],
    sourcemap: isDev,
    minify: !isDev,
    target: ['es2020'],
    format: 'esm',
};

if (isDev) {
    const ctx = await esbuild.context({
        ...SETTINGS,
        sourcemap: true,
    });
    await ctx.watch();
} else {
    await esbuild.build({ ...SETTINGS, minify: true });
}
