import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { goWasm } from '../esbuild-plugins/go-wasm.mjs';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: '../dist/squashfs',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['require', 'fs', 'path'],
  plugins: [
    goWasm({
      projectDir: '.',
      outWasmFile: 'squashfs.wasm',
      watchPaths: ['main_wasm.go', 'go.mod']
    }),
    copy({
      assets: [
        {
          from: 'index.html',
          to: 'index.html',
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ],
    }),
  ],
};

async function runBuild() {
  if (process.env['BUILD_MODE'] === 'dev') {
    const ctx = await esbuild.context({
      ...SETTINGS,
      sourcemap: true,
    });
    await ctx.watch();
  } else {
    await esbuild.build({ ...SETTINGS, minify: true });
  }
}

runBuild();
