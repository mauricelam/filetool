import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import { emscriptenWasm } from '../esbuild-plugins/emscripten-wasm.mjs';

const projectDir = process.cwd();

const SETTINGS = {
  entryPoints: ['src/main.tsx', 'src/worker.ts'],
  outdir: "../dist/bloaty",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path', 'node:fs', 'node:path', 'node:crypto', 'crypto', 'node:module'],
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
        }
      ]
    }),
    emscriptenWasm({
      name: 'bloaty',
      projectDir: 'bloaty-src',
      command: `make -f Makefile.wasm`,
      artifacts: ['web/bloaty.js', 'web/bloaty.wasm'],
      resolveArtifacts: true,
    }),
  ],
  loader: {
    '.css': 'css',
  }
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
