import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/ffmpeg",
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
        { from: ["../node_modules/@ffmpeg/ffmpeg/dist/esm/*.js"], to: ["./"] },
        {
          from: ["../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js"],
          to: ["./ffmpeg-core.js"],
        },
        {
          from: ["../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm"],
          to: ["./ffmpeg-core.wasm"],
        },
        {
          from: ["../node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.js"],
          to: ["./ffmpeg-core-mt.js"],
        },
        {
          from: ["../node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.worker.js"],
          to: ["./ffmpeg-core-worker-mt.js"],
        },
        {
          from: ["../node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.wasm"],
          to: ["./ffmpeg-core-mt.wasm"],
        }
      ]
    })
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
