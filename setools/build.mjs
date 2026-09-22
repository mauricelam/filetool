import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const selinuxWasmPkgDir = path.dirname(require.resolve('@mauricelam/selinux-wasm/package.json'));

const outDir = path.resolve(process.cwd(), '../dist/setools');
fs.mkdirSync(outDir, { recursive: true });

// Copy WASM binary
fs.copyFileSync(
  path.join(selinuxWasmPkgDir, 'dist/libsepol_browser.wasm'),
  path.join(outDir, 'sepolicy.wasm')
);

// Copy JS wrapper and ensure default ES export for module loaders
const jsContent = fs.readFileSync(path.join(selinuxWasmPkgDir, 'dist/libsepol_browser.js'), 'utf8');
fs.writeFileSync(path.join(outDir, 'sepolicy.js'), jsContent + '\nexport default libsepol;\n');

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
