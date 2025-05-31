import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path'; // Import path
import { fileURLToPath } from 'url'; // Import for __dirname
import { dirname } from 'path'; // Import for __dirname
import { esbuildPluginRustWasm } from '../../tools/esbuild-plugins/esbuild-plugin-rust-wasm.mjs';
import { esbuildPluginGoWasm } from '../../tools/esbuild-plugins/esbuild-plugin-go-wasm.mjs';
import { wasmLoader } from 'esbuild-plugin-wasm'; // Import wasmLoader, might be needed for Rust Wasm

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve project directories
const rustDexViewerDir = path.resolve(__dirname, 'dexviewer');
const goDexViewerDir = path.resolve(__dirname, 'godexviewer');

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/rustdexviewer",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    esbuildPluginRustWasm({
      projectDir: rustDexViewerDir,
      outName: 'dexviewer', // Results in dexviewer_bg.wasm and dexviewer.js
      watchPaths: [ // Relative to rustDexViewerDir
        'src/**/*.rs',
        'Cargo.toml',
        // Watch paths for the dependent local workspace dex-parser
        path.join('..', 'dex-parser', 'src', '**', '*.rs'),
        path.join('..', 'dex-parser', 'Cargo.toml'),
      ]
    }),
    // It's unclear if wasmLoader is needed here or if the rustWasmPlugin's JS output is sufficient.
    // Keeping it for now, similar to binaryxml.
    wasmLoader(),
    esbuildPluginGoWasm({
      projectDir: goDexViewerDir,
      outWasmFile: 'dextk.wasm',
      wasmExecJsDest: 'wasm_exec.js',
      watchPaths: ['**/*.go', 'go.mod'] // Relative to goDexViewerDir
    }),
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ]
    }),
  ],
}

if (process.env['BUILD_MODE'] === 'dev') {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
    // banner: { // This commented out banner will be removed
    //   js: `new EventSource('/esbuild').addEventListener('change', () => location.reload()); `,
    // },
  });
  await ctx.watch();
} else {
  const buildSettings = { ...SETTINGS, minify: true };
  delete buildSettings.banner; // Ensure no banner in prod
  await esbuild.build(buildSettings);
}
