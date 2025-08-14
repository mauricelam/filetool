import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path'; // Import path
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';
import { goWasm } from '../esbuild-plugins/go-wasm.mjs';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/proguard",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    rustWasm({
      projectDir: 'proguard-wasm',
      outName: 'proguard-wasm', // Results in proguard-wasm_bg.wasm and proguard-wasm.js
      watchPaths: [ // Relative to rustDexViewerDir
        'src/**/*.rs',
        'Cargo.toml',
      ]
    }),
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
        {
          from: ["testdata/*"],
          to: ["testdata"],
          watch: process.env['BUILD_MODE'] === 'dev',
        }
      ]
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
  const buildSettings = { ...SETTINGS, minify: true };
  delete buildSettings.banner; // Ensure no banner in prod
  await esbuild.build(buildSettings);
}
