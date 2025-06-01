import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process'; // Import process
import { goWasm } from '../esbuild-plugins/go-wasm.mjs'; // Import the new plugin

const isWatchMode = process.env.BUILD_MODE === 'dev';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/der", // This is where esbuild will output main.js, index.html etc.
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'], // 'crypto' might not be needed
  plugins: [
    goWasm({
      projectDir: 'wasm',
      // Since esbuild's outdir is '../dist/der', and we want 'der.wasm' in it.
      outWasmFile: 'der.wasm',
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
