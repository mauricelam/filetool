import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs'; // Import the new plugin

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/classfile",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
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
      projectDir: 'classfile-wasm',
      outName: 'classfile_wasm', // wasm-pack will generate classfile_wasm_bg.wasm and classfile_wasm.js
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
  // Remove the commented out banner from the build settings too
  const buildSettings = { ...SETTINGS, minify: true };
  delete buildSettings.banner; // Ensure no banner in prod
  await esbuild.build(buildSettings);
}
