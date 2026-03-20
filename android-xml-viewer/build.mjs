import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';

const arscPath = '../apk-viewer/abxml-rs/resources/resources.arsc';
const compressedArscPath = './android.arsc.gz';

if (fs.existsSync(arscPath)) {
  const input = fs.readFileSync(arscPath);
  const output = zlib.gzipSync(input);
  fs.writeFileSync(compressedArscPath, output);
  console.log(`Compressed ${arscPath} to ${compressedArscPath}`);
}

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/android-xml-viewer",
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
          from: ["../node_modules/wasmagic/dist/libmagic-wrapper.wasm"],
          to: ["libmagic-wrapper.wasm"],
        },
        {
          from: [compressedArscPath],
          to: ["android.arsc.gz"],
        }
      ]
    }),
    rustWasm({
      projectDir: 'abxml-wasm-bindings',
      outName: 'abxml-wasm-bindings',
      watchPaths: [
        'src/**/*.rs',
        'Cargo.toml',
        path.join('..', 'abxml-rs', 'src', '**', '*.rs'),
        path.join('..', 'abxml-rs', 'Cargo.toml'),
      ]
    }),
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
