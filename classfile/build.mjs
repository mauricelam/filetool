import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { wasmLoader } from 'esbuild-plugin-wasm'; // Keep for now
import process from 'process';
import path from 'path'; // Import path
import { fileURLToPath } from 'url'; // Import for __dirname
import { dirname } from 'path'; // Import for __dirname
import { esbuildPluginRustWasm } from '../../tools/esbuild-plugins/esbuild-plugin-rust-wasm.mjs'; // Import the new plugin

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the project directory for the Wasm module
const classfileWasmDir = path.resolve(__dirname, 'classfile-wasm');

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
    wasmLoader(), // Keep for now, verify during testing
    esbuildPluginRustWasm({
      projectDir: classfileWasmDir,
      outName: 'classfile_wasm', // wasm-pack will generate classfile_wasm_bg.wasm and classfile_wasm.js
      watchPaths: [ // Paths relative to projectDir (classfile-wasm)
        'src/**/*.rs',
        'Cargo.toml'
      ]
    }),
  ],
}

if (process.env['BUILD_MODE'] === 'dev') {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
    // banner: { // This commented out banner will be removed
    //   js: `new EventSource('/esbuild').addEventListener('change', () => location.reload());`,
    // },
  });
  await ctx.watch();
} else {
  // Remove the commented out banner from the build settings too
  const buildSettings = { ...SETTINGS, minify: true };
  delete buildSettings.banner; // Ensure no banner in prod
  await esbuild.build(buildSettings);
}
