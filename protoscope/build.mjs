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
// In protoscope, main.go is in the same directory as build.mjs
const goProtoscopeDir = __dirname;
const outDir = '../dist/protoscope';

const SETTINGS = {
  entryPoints: [path.join(__dirname, 'main.tsx')],
  outdir: outDir,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['require', 'fs', 'path'],
  plugins: [
    esbuildPluginGoWasm({
      projectDir: goProtoscopeDir,
      // main.go is directly in projectDir, so no subpath needed for build command.
      // The plugin's default goBuildCommand builds sources in projectDir.
      outWasmFile: 'protoscope.wasm', // Output file name in the esbuild outdir
      wasmExecJsDest: 'wasm_exec.js', // Destination for wasm_exec.js in esbuild outdir
      watchPaths: ['main.go', 'go.mod', 'go.sum'] // Relative to projectDir
    }),
    copy({
      assets: [
        {
          from: 'index.html',
          to: 'index.html', // Relative to esbuild's outdir
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ],
    }),
  ],
};

async function runBuild() {
  try {
    if (process.env['BUILD_MODE'] === 'dev') {
      const ctx = await esbuild.context({
        ...SETTINGS,
        sourcemap: true,
      });
      await ctx.watch();
      console.log('Watching for changes in protoscope build...');
    } else {
      await esbuild.build({ ...SETTINGS, minify: true });
      console.log('Protoscope build completed successfully.');
    }
  } catch (err) {
    console.error('Protoscope build failed:', err);
    process.exit(1);
  }
}

runBuild();
