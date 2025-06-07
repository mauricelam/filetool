import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const isDev = process.argv.includes('--dev');

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/graphviz",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'], // external for node modules if any are accidentally imported
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: isDev,
        }
      ],
    }),
  ],
};

if (isDev) {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
  });
  await ctx.watch();
  console.log("Watching for changes in graphviz...");
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
  console.log("Built graphviz successfully!");
}
