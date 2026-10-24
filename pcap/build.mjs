import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const wiregasmPkgDir = path.dirname(require.resolve('@goodtools/wiregasm/package.json'));

const isDev = process.env.BUILD_MODE === 'dev';

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
        {
          from: [
            path.join(wiregasmPkgDir, 'dist/wiregasm.wasm.gz'),
            path.join(wiregasmPkgDir, 'dist/wiregasm.data.gz'),
            path.join(wiregasmPkgDir, 'dist/wiregasm.js'),
          ],
          to: ['./'],
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
