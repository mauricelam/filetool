import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';

const projectDir = process.cwd();

const SETTINGS = {
  entryPoints: ['src/main.tsx', 'src/worker.ts'],
  outdir: "../dist/ghidra",
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
        },
        {
          from: ["../node_modules/@mauricelam/ghidra-decompiler-wasm/dist/processors.json"],
          to: ["."],
        },
        {
          from: ["../node_modules/@mauricelam/ghidra-decompiler-wasm/dist/ghidra_decompiler.wasm"],
          to: ["ghidra_decompiler.wasm"],
        }
      ]
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

const processorsDir = path.join(projectDir, '..', 'node_modules', '@mauricelam', 'ghidra-decompiler-wasm', 'dist', 'Processors');
const targetDir = path.join(projectDir, '..', 'dist', 'ghidra', 'Processors');

function copyProcessors(src, dest) {
  if (!fs.existsSync(src)) return;

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyProcessors(srcPath, destPath);
    } else if (entry.isFile() && (entry.name.endsWith('.sla') || entry.name.endsWith('.pspec') || entry.name.endsWith('.cspec'))) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying processor specifications...');
const oldTarget = path.join(projectDir, '..', 'dist', 'ghidra', 'processors');
if (fs.existsSync(oldTarget)) {
  fs.rmSync(oldTarget, { recursive: true, force: true });
}
copyProcessors(processorsDir, targetDir);
console.log('Done copying processors.');

