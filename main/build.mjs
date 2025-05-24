import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "dist",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    copy({
      assets: [
        {
          from: ["../node_modules/wasmagic/dist/libmagic-wrapper.wasm"],
          to: ["libmagic-wrapper.wasm"],
        },
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
        {
          from: ["icons/icons/*.svg"],
          to: ["icons/"],
        },
      ]
    })
  ],
}

if (process.env['BUILD_MODE'] === 'dev') {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
    // banner: {
    //   js: `new EventSource('/esbuild').addEventListener('change', () => location.reload());`,
    // },
    outdir: `../dist`
  });
  await ctx.watch();
} else {
  await esbuild.build({ ...SETTINGS, minify: true, outdir: `../dist` });
}
