import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { resolve, dirname } from 'path'; // Keep resolve and dirname
import { fileURLToPath } from 'url'; // Keep for __dirname
import process from 'process'; // Import process
import { esbuildPluginGoWasm } from '../../tools/esbuild-plugins/esbuild-plugin-go-wasm.mjs'; // Import the new plugin

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatchMode = process.env.BUILD_MODE === 'dev';

// Resolve the project directory for the Wasm module
const goWasmProjectDir = resolve(__dirname, 'wasm');

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/der", // This is where esbuild will output main.js, index.html etc.
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'], // 'crypto' might not be needed
  plugins: [
    esbuildPluginGoWasm({
      projectDir: goWasmProjectDir,
      // outWasmFile is relative to esbuild's outdir.
      // Since esbuild's outdir is '../dist/der', and we want 'der.wasm' in it.
      outWasmFile: 'der.wasm',
      // wasmExecJsDest is also relative to esbuild's outdir
      wasmExecJsDest: 'wasm_exec.js',
      // watchPaths are relative to projectDir (goWasmProjectDir)
      watchPaths: ['**/*.go', 'go.mod', '../der-ascii/**/*.go'], // Added der-ascii
    }),
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"], // Relative to esbuild's outdir
          watch: isWatchMode,
        },
      ]
    }),
  ],
}

if (isWatchMode) {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
  });
  console.log('Watching for changes in der build...'); // More specific log
  await ctx.watch();
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
  console.log('DER build completed successfully'); // More specific log
}
