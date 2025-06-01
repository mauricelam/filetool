import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path'; // Import path
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs'; // Import the new plugin

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/binaryxml",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'], // 'crypto' might not be needed here
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
      projectDir: 'abxml-wrapper',
      outName: 'abxml_wrapper', // wasm-pack will add _bg to the .wasm file, so this becomes abxml_wrapper_bg.wasm and abxml_wrapper.js
      watchPaths: [ // Paths relative to projectDir (abxml-wrapper)
        'src/**/*.rs',
        'Cargo.toml',
        // Watch paths for the dependent local workspace abxml-rs
        // This requires careful relative pathing from abxml-wrapper to abxml-rs
        // Assuming abxml-rs is a sibling or at a known relative path to abxml-wrapper
        // For this example, let's assume direct relative path for simplicity
        // This might need adjustment based on actual monorepo structure if chokidar has issues.
        // A robust solution might involve passing absolute paths or resolving them carefully.
        path.join('..', 'abxml-rs', 'src', '**', '*.rs'),
        path.join('..', 'abxml-rs', 'Cargo.toml'),
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
  await esbuild.build({ ...SETTINGS, minify: true });
}
