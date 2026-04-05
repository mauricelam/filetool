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
      command: `git checkout Makefile.wasm && (grep -q "EXPORT_ES6=1" Makefile.wasm || patch -p1 < ../Makefile.wasm.patch) && make -f Makefile.wasm WEB_DIR=.`,
      artifacts: ['bloaty.js', 'bloaty.wasm']
    }),
    {
      name: 'resolve-bloaty',
      setup(build) {
        // Match the import in worker.ts and mark it as external
        // so it stays as a relative import in the bundled worker.js
        build.onResolve({ filter: /^\.\/bloaty\.js$/ }, args => {
          return { path: './bloaty.js', external: true }
        })
      },
    },
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
