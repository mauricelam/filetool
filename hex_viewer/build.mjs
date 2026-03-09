import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/hex_viewer",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path', './md5-wasm.js'],
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ]
    }),
    rustWasm({
      projectDir: 'md5-wasm',
      outName: 'md5-wasm',
    }),
  ],
}

if (process.env['BUILD_MODE'] === 'dev') {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
  });
  await ctx.watch();
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
}
