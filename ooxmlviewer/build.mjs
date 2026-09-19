import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const args = process.argv.slice(2);
const isDev = process.env['BUILD_MODE'] === 'dev' || args.includes('--dev');

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outfile: '../dist/ooxmlviewer/main.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  external: ['require', 'fs', 'path'],
  plugins: [
    copy({
      assets: [
        {
          from: ['index.html'],
          to: ['index.html'],
        },
        {
          from: ['../node_modules/@silurus/ooxml/dist/*.wasm'],
          to: ['./'],
        },
        {
          from: ['../node_modules/@silurus/ooxml/dist/assets/*'],
          to: ['./assets'],
        }
      ]
    })
  ],
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
  }
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
