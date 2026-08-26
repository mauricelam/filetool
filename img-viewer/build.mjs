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
            command: `export PATH="/tmp/emsdk:/tmp/emsdk/upstream/emscripten:$PATH"; cd erofs-utils && if [ ! -f Makefile ]; then ./autogen.sh && emconfigure ./configure MAX_BLOCK_SIZE=4096 --disable-multithreading --without-uuid --without-selinux --disable-fuse --disable-ublk --disable-s3 --disable-oci --disable-fanotify; fi && emmake make -C lib && emcc -O2 -Iinclude ../erofs_api.c lib/.libs/liberofs.a -o ../../dist/img-viewer/erofs.js -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME="createErofsModule" -s EXPORT_ES6=1 -s ENVIRONMENT=web -s ALLOW_MEMORY_GROWTH=1 -s STACK_SIZE=1048576 -s FORCE_FILESYSTEM=1 -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "FS", "UTF8ToString", "HEAPU8", "HEAPU32"]' -s EXPORTED_FUNCTIONS='["_malloc", "_free", "_api_parse_erofs", "_api_read_file", "_api_free_buf"]'`,
            watchFiles: ['erofs_api.c']
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
