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

// Manual copy for processors to ensure they are available at the paths specified in processors.json
const processorsDir = path.join(projectDir, 'ghidra-decompiler', 'Processors');
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
copyProcessors(processorsDir, targetDir);
console.log('Done copying processors.');
