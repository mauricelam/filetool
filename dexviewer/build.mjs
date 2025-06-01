import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { goWasm } from '../esbuild-plugins/go-wasm.mjs'; // Import the new plugin

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/dexviewer",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    goWasm({
      projectDir: 'godexviewer',
      outWasmFile: 'dextk.wasm', // Output file name in the esbuild outdir
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
  });
  await ctx.watch();
} else {
  const buildSettings = { ...SETTINGS, minify: true };
  delete buildSettings.banner; // Ensure no banner in prod
  await esbuild.build(buildSettings);
}
