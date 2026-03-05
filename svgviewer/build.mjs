import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const args = process.argv.slice(2);
const isDev = args.includes('--dev');

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outfile: "../dist/svgviewer/main.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
        }
      ]
    })
  ],
};

if (isDev) {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
  });
  await ctx.watch();
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
}
