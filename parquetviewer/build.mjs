import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const isDev = process.env.BUILD_MODE === 'dev';

const options = {
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/parquetviewer',
    platform: 'browser',
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
    target: ['es2022'],
    format: 'esm',
    define: {
        'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    }
};

if (isDev) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(options);
}
