import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path'; // Import path
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';
import { goWasm } from '../esbuild-plugins/go-wasm.mjs';
import { wasmLoader } from 'esbuild-plugin-wasm'; // Import wasmLoader, might be needed for Rust Wasm

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/rustdexviewer",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    rustWasm({
      projectDir: 'dexviewer',
      outName: 'dexviewer', // Results in dexviewer_bg.wasm and dexviewer.js
      watchPaths: [ // Relative to rustDexViewerDir
        'src/**/*.rs',
        'Cargo.toml',
        // Watch paths for the dependent local workspace dex-parser
        path.join('..', 'dex-parser', 'src', '**', '*.rs'),
        path.join('..', 'dex-parser', 'Cargo.toml'),
      ]
    }),
    goWasm({
      projectDir: 'godexviewer',
      outWasmFile: 'dextk.wasm',
      watchPaths: ['**/*.go', 'go.mod'] // Relative to goDexViewerDir
    }),
    wasmLoader(),
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
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
