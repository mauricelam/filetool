import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const OUTDIR = "../dist/ffmpeg";

async function gzipWasmFiles(outdir) {
  const files = fs.readdirSync(outdir);
  for (const file of files) {
    if (file.endsWith('.wasm')) {
      const filepath = path.join(outdir, file);
      console.log(`Compressing ${file}`);
      const buffer = fs.readFileSync(filepath);
      const compressed = zlib.gzipSync(buffer, { level: 9 });
      fs.writeFileSync(`${filepath}.gz`, compressed);
      fs.unlinkSync(filepath);
      console.log(`Compressed ${file}: ${(buffer.length / 1024 / 1024).toFixed(2)} MB -> ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
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
        name: 'wasm-compressor',
        setup(build) {
          build.onEnd(async () => {
            await gzipWasmFiles(OUTDIR);
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
  await gzipWasmFiles(OUTDIR);
}
