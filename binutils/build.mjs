import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

let rewriteBinutilsWasmPath = {
  name: 'rewrite-binutils-wasm-path',
  setup(build) {
    let filter = /^@binutils-wasm\/binutils/
    build.onResolve({ filter }, args => {
      return { path: `./${args.path}/index.mjs`, external: true };
    })
  },
}

const SETTINGS = {
  entryPoints: ['main.tsx', 'worker.ts'],
  outdir: "../dist/binutils",
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
    copy({
      assets: [
        {
          from: ["../node_modules/@binutils-wasm/binutils/dist/*.mjs"],
          to: ["@binutils-wasm/binutils/"],
        },
      ]
    }),
    rewriteBinutilsWasmPath,
  ],
  loader: {
    '.css': 'css',
  }
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
