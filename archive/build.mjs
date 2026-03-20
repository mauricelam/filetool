import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { execSync } from 'child_process';

execSync('npx wasm-pack build --target web --out-dir pkg archive/archive-wasm', { stdio: 'inherit', cwd: '..' });

const SETTINGS = {
  entryPoints: ['main.tsx', './worker.ts'],
  outdir: "../dist/archive",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path', 'crypto'],
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
        {
          from: ["archive-wasm/pkg/archive_wasm_bg.wasm"],
          to: ["archive_wasm_bg.wasm"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
        {
          from: ["archive-wasm/pkg/archive_wasm.js"],
          to: ["archive_wasm.js"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
        {
            from: ["../node_modules/wasmagic/dist/libmagic-wrapper.wasm"],
            to: ["libmagic-wrapper.wasm"],
        }
      ]
    })
  ],
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
