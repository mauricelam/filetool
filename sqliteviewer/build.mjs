import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const isDev = process.env.BUILD_MODE === 'dev';

const mainOptions = {
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/sqliteviewer',
    platform: 'browser',
    plugins: [
        copy({
            assets: [
                {
                    from: './index.html',
                    to: 'index.html'
                },
                {
                    from: './node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm',
                    to: 'sqlite3.wasm'
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

const workerOptions = {
    entryPoints: ['sqlite.worker.ts'],
    bundle: true,
    outdir: '../dist/sqliteviewer',
    platform: 'browser',
    sourcemap: isDev,
    minify: !isDev,
    target: ['es2022'],
    format: 'esm',
    define: {
        'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    }
};

if (isDev) {
    const mainCtx = await esbuild.context(mainOptions);
    await mainCtx.watch();
    const workerCtx = await esbuild.context(workerOptions);
    await workerCtx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(mainOptions);
    await esbuild.build(workerOptions);
}