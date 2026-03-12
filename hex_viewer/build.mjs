import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/hex_viewer",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    rustWasm({
      projectDir: 'wasm',
      outName: 'hex-viewer-wasm',
      watchPaths: ['src/**/*.rs', 'Cargo.toml']
    }),
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
        {
            from: ["binwalk-styles.css"],
            to: ["binwalk-styles.css"],
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
  await esbuild.build(buildSettings);
}
