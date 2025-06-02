import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const isDev = process.argv.includes('--dev');

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/graphvizviewer",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'], // external for node modules if any are accidentally imported
  plugins: [
    copy({
      // this is optional, targetPaths are relative to outdir
      resolveFrom: 'cwd',
      assets: [
        {
          from: ["./index.html"],
          to: ["./index.html"],
          watch: isDev,
        },
        {
          from: ['./node_modules/@hpcc-js/wasm/dist/*.wasm'],
          to: ['./'], // copies wasm files to the root of the outdir
          watch: false, // No need to watch wasm files
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
  console.log("Watching for changes in graphvizviewer...");
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
  console.log("Built graphvizviewer successfully!");
}
