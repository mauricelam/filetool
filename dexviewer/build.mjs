import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path'; // Import path
import { fileURLToPath } from 'url'; // Import for __dirname
import { dirname } from 'path'; // Import for __dirname
import { esbuildPluginGoWasm } from '../../tools/esbuild-plugins/esbuild-plugin-go-wasm.mjs'; // Import the new plugin

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the project directory for the Wasm module
const goDexViewerDir = path.resolve(__dirname, 'godexviewer');

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/dexviewer",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    esbuildPluginGoWasm({
      projectDir: goDexViewerDir,
      outWasmFile: 'dextk.wasm', // Output file name in the esbuild outdir
      wasmExecJsDest: 'wasm_exec.js', // Destination for wasm_exec.js in esbuild outdir
      // goBuildCommand: 'GOOS=js GOARCH=wasm go build -o', // Default is fine
      watchPaths: ['**/*.go', 'go.mod'] // Relative to projectDir (goDexViewerDir)
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
