import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';
import { emscriptenWasm } from '../esbuild-plugins/emscripten-wasm.mjs';

const isDev = process.env.BUILD_MODE === 'dev';
const isWatch = process.argv.includes('--watch');

const context = await esbuild.context({
    entryPoints: ['main.tsx'],
    bundle: true,
    outdir: '../dist/img-viewer',
    platform: 'browser',
    plugins: [
        rustWasm({
            projectDir: 'ext4-wasm',
            outName: 'ext4-wasm',
            watchPaths: ['src/**/*.rs']
        }),
        emscriptenWasm({
            name: 'erofs',
            projectDir: '.',
            command: 'bash build-erofs.sh',
            watchFiles: ['erofs_api.c', 'build-erofs.sh']
        }),
        {
            name: 'resolve-erofs',
            setup(build) {
                build.onResolve({ filter: /^\.\/erofs\.js$/ }, args => {
                    return { path: './erofs.js', external: true };
                });
            }
        },
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

if (isWatch) {
    await context.watch();
} else {
    await context.rebuild();
    await context.dispose();
}
