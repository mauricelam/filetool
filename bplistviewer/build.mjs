import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const outdir = '../dist/bplistviewer';

fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });
fs.cpSync('index.html', path.join(outdir, 'index.html'));

await esbuild.build({
    entryPoints: ['main.tsx'],
    bundle: true,
    outfile: path.join(outdir, 'main.js'),
    format: 'esm',
    define: {
        'process.env.NODE_ENV': '"production"',
    }
}).catch(() => process.exit(1));
