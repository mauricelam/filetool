import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import fs from 'fs';
import path from 'path';

const OUTDIR = "../dist/ffmpeg";

async function splitWasmFiles(outdir) {
  const files = fs.readdirSync(outdir);
  for (const file of files) {
    if (file.endsWith('.wasm')) {
      const filepath = path.join(outdir, file);
      const stats = fs.statSync(filepath);
      const maxSize = 20 * 1024 * 1024; // 20MB

      if (stats.size > maxSize) {
        console.log(`Splitting ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        const buffer = fs.readFileSync(filepath);
        let offset = 0;
        let chunkIndex = 0;
        while (offset < buffer.length) {
          const chunk = buffer.subarray(offset, offset + maxSize);
          fs.writeFileSync(`${filepath}.${chunkIndex}`, chunk);
          offset += maxSize;
          chunkIndex++;
        }
        fs.unlinkSync(filepath);
        console.log(`Split ${file} into ${chunkIndex} chunks`);
      }
    }
  }
}

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: OUTDIR,
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
    plugins: [
      ...SETTINGS.plugins,
      {
        name: 'wasm-splitter',
        setup(build) {
          build.onEnd(async () => {
            await splitWasmFiles(OUTDIR);
          });
        },
      },
    ],
  });
  await ctx.watch();
} else {
  await esbuild.build({
    ...SETTINGS,
    minify: true,
  });
  await splitWasmFiles(OUTDIR);
}
