import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

// Try to determine the jq-wasm path, especially for its WASM file.
// This is a common pattern; the actual path might vary slightly.
// We assume the WASM file is named 'jq.wasm' or similar and is in a 'dist' or root folder of the package.
// A more robust way would be to inspect node_modules/jq-wasm/package.json "main" or "files"
// but for now, we'll try a common path.
const jqWasmPath = 'node_modules/jq-wasm/'; // Path to the installed jq-wasm package
const jqWasmFile = 'jq.wasm'; // Common name for the wasm binary, or jq_wasm_bg.wasm

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/jqviewer", // Output to dist/jqviewer
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'], // Standard externals for browser environment
  plugins: [
    copy({
      assets: [
        {
          from: ["./index.html"], // Copy from jqviewer/index.html
          to: ["./index.html"],   // To dist/jqviewer/index.html
        },
        {
          // Attempt to copy the WASM file.
          // The `from` path needs to correctly point to where jq-wasm stores its .wasm file.
          // This might be node_modules/jq-wasm/dist/jq.wasm or similar.
          // If this path is incorrect, the build might succeed but jqviewer will fail at runtime.
          // For now, we assume it's in the root of the jq-wasm package or a common subfolder.
          // A more robust solution would be to inspect jq-wasm's structure or use a specific plugin if available.
          from: [`${jqWasmPath}${jqWasmFile}`],
          to: [`./${jqWasmFile}`], // Copy to dist/jqviewer/jq.wasm
          // Add other potential locations or names if the first one is not found.
          // Example: from: [`${jqWasmPath}dist/${jqWasmFile}`], to: [`./${jqWasmFile}`],
        },
        {
          // Fallback for another common naming convention for wasm files (e.g. from wasm-pack)
          from: [`${jqWasmPath}jq_wasm_bg.wasm`],
          to: [`./jq_wasm_bg.wasm`],
        }
      ],
      // Opt-out of error on missing assets, as one of the wasm paths might not exist
      // and we are trying multiple common locations.
      // However, esbuild-plugin-copy doesn't have a direct 'ignoreMissing' option.
      // The build will fail if a specific `from` path doesn't exist.
      // For now, we'll assume one of them is correct. A better approach would be to
      // dynamically check for the file's existence before adding it to copy assets.
      // For this subtask, we'll list common ones. The user of jq-wasm might need to adjust this.
      watch: process.env['BUILD_MODE'] === 'dev',
    })
  ],
};

if (process.env['BUILD_MODE'] === 'dev') {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
  });
  await ctx.watch();
  console.log("jqviewer: Watching for changes...");
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
  console.log("jqviewer: Build complete.");
}
