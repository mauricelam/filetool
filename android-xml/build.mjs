import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import admZip from 'adm-zip';
import { rustWasm } from '../esbuild-plugins/rust-wasm.mjs';

const arscPath = '../apk-viewer/abxml-rs/resources/resources.arsc';
const compressedArscPath = './android.arsc.zip';

if (fs.existsSync(arscPath)) {
  const input = fs.readFileSync(arscPath);
  const zip = new admZip();
  zip.addFile('android.arsc', input);
  zip.writeZip(compressedArscPath);
  console.log(`Zipped ${arscPath} to ${compressedArscPath}`);
}

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/android-xml",
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
          to: ["android.arsc.zip"],
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
