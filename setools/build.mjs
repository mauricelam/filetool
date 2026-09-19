import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const SETTINGS = {
  entryPoints: ['main.tsx', 'worker.ts'],
  outdir: "../dist/setools",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path', 'node:fs', 'node:path', 'node:crypto'],
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
        },
        {
          from: ["../node_modules/@mauricelam/selinux-wasm/dist/libsepol_browser.js"],
          to: ["sepolicy.js"],
        },
        {
          from: ["../node_modules/@mauricelam/selinux-wasm/dist/libsepol_browser.wasm"],
          to: ["sepolicy.wasm"],
        }
      ]
    }),
    {
      name: 'resolve-sepolicy',
      setup(build) {
        build.onResolve({ filter: /^\.\/sepolicy\.js$/ }, args => {
          return { path: './sepolicy.js', external: true }
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
