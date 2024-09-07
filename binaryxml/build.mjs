import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { wasmPack } from 'esbuild-plugin-wasm-pack';
import { wasmLoader } from 'esbuild-plugin-wasm';
import process from 'process';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/binaryxml",
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
    // wasmPack({
    //   path: 'abxml-wrapper'
    // }),
    wasmLoader(),
  ],
}

if (process.env['BUILD_MODE'] === 'dev') {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
    // banner: {
    //   js: `new EventSource('/esbuild').addEventListener('change', () => location.reload());`,
    // },
  });
  await ctx.watch();
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
}
