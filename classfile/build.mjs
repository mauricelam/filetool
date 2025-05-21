import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { wasmLoader } from 'esbuild-plugin-wasm';
import process from 'process';
import { execSync } from 'child_process';
import fs from 'fs';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/classfile",
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
    wasmLoader(),
    {
      name: 'wasm-pack',
      setup(build) {
        build.onStart(() => {
          execSync(`wasm-pack build classfile-wasm --target web`, {
            stdio: 'inherit'
          });
          fs.mkdirSync(build.initialOptions.outdir, { recursive: true });
          fs.copyFileSync(
            'classfile-wasm/pkg/classfile_wasm_bg.wasm',
            `${build.initialOptions.outdir}/classfile_wasm_bg.wasm`
          );
        });
      }
    },

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
