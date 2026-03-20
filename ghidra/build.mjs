import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import { emscriptenWasm } from '../esbuild-plugins/emscripten-wasm.mjs';

const projectDir = process.cwd();

const SETTINGS = {
  entryPoints: ['src/main.tsx', 'src/worker.ts'],
  outdir: "../dist/ghidra",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path', 'node:fs', 'node:path', 'node:crypto', 'crypto'],
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
        },
        {
          from: ["ghidra-decompiler/Processors/*/*.{sla,pspec,cspec}"],
          to: ["processors/"],
        },
        {
          from: ["ghidra-decompiler/wasm_examples/processors.json"],
          to: ["."],
        }
      ]
    }),
    emscriptenWasm({
      name: 'ghidra',
      projectDir: 'ghidra-decompiler',
      command: `make -j -f Makefile.wasm ghidra_decompiler.js`,
      artifacts: ['ghidra_decompiler.js', 'ghidra_decompiler.wasm'],
    }),
    {
      name: 'ghidra-resolver',
      setup(build) {
        build.onResolve({ filter: /^\.\/ghidra_decompiler\.js$/ }, args => {
          return { path: path.join(projectDir, 'ghidra-decompiler', 'ghidra_decompiler.js') };
        });
      }
    }
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
