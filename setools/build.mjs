import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const selinuxDir = path.resolve('../node_modules/@mauricelam/selinux-wasm');
const jsPath = path.join(selinuxDir, 'dist', 'libsepol_browser.js');

if (!fs.existsSync(jsPath)) {
  const libsepolDir = path.join(selinuxDir, 'libsepol');
  if (fs.existsSync(libsepolDir)) {
    console.log('Building @mauricelam/selinux-wasm dist artifacts...');
    execSync('make -f Makefile.wasm dist', { cwd: libsepolDir, stdio: 'inherit' });
  }
}

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
