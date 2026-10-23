import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const wiregasmPkgDir = path.dirname(require.resolve('@goodtools/wiregasm/package.json'));

const isDev = process.env.BUILD_MODE === 'dev';
const outDir = path.resolve(process.cwd(), '../dist/pcap');

// Clean output folder
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// Copy gzipped wiregasm runtime assets to stay under Cloudflare Pages 25MB file size limit
fs.copyFileSync(path.join(wiregasmPkgDir, 'dist/wiregasm.wasm.gz'), path.join(outDir, 'wiregasm.wasm.gz'));
fs.copyFileSync(path.join(wiregasmPkgDir, 'dist/wiregasm.data.gz'), path.join(outDir, 'wiregasm.data.gz'));
fs.copyFileSync(path.join(wiregasmPkgDir, 'dist/wiregasm.js'), path.join(outDir, 'wiregasm.js'));

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: '../dist/pcap',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  external: ['fs', 'path', 'crypto', 'child_process', 'node:fs', 'node:path', 'node:crypto', 'node:child_process'],
  plugins: [
    copy({
      assets: [
        {
          from: ['./index.html'],
          to: ['index.html'],
        },
      ]
    })
  ],
  sourcemap: isDev,
  minify: !isDev,
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
