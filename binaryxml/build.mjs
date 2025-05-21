import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { wasmLoader } from 'esbuild-plugin-wasm';
import { execSync } from 'child_process';
import process from 'process';
import fs from 'fs';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/binaryxml",
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
          execSync(`wasm-pack build abxml-wrapper --target web`, {
            stdio: 'inherit'
          });
          fs.mkdirSync(build.initialOptions.outdir, { recursive: true });
          fs.copyFileSync(
            'abxml-wrapper/pkg/abxml_wrapper_bg.wasm',
            `${build.initialOptions.outdir}/abxml_wrapper_bg.wasm`
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
