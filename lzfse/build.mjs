
import esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';

esbuild.build({
    entryPoints: ['main.tsx'],
    bundle: true,
    outfile: '../../dist/lzfse/main.js',
    platform: 'browser',
    format: 'esm',
    plugins: [
        copy({
            assets: [
                {
                    from: ['./index.html'],
                    to: ['../../dist/lzfse/'],
                },
                {
                    from: ['./lzfse.wasm'],
                    to: ['../../dist/lzfse/'],
                },
                {
                    from: ['./lzfse.js'],
                    to: ['../../dist/lzfse/'],
                },
            ],
        }),
    ],
    loader: {
        '.tsx': 'tsx',
    },
    logLevel: 'info',
}).catch(() => process.exit(1));

esbuild.build({
    entryPoints: ['worker.ts'],
    bundle: true,
    outfile: '../../dist/lzfse/worker.js',
    platform: 'browser',
    format: 'esm',
    logLevel: 'info',
}).catch(() => process.exit(1));
