import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { wasmLoader } from 'esbuild-plugin-wasm';
import { execSync } from 'child_process';
import process from 'process';
import fs from 'fs';
import chokidar from 'chokidar';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/binaryxml",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ]
    }),
    wasmLoader(),
    {
      name: 'wasm-pack',
      setup(build) {
        let isBuilding = false;
        let needsRebuild = false;
        let watcher = null;

        const buildWasm = () => {
          if (isBuilding) {
            needsRebuild = true;
            return;
          }
          isBuilding = true;
          try {
            execSync(`wasm-pack build abxml-wrapper --target web`, {
              stdio: 'inherit'
            });
            fs.mkdirSync(build.initialOptions.outdir, { recursive: true });
            fs.copyFileSync(
              'abxml-wrapper/pkg/abxml_wrapper_bg.wasm',
              `${build.initialOptions.outdir}/abxml_wrapper_bg.wasm`
            );
          } catch (error) {
            console.error(`Failed to build WASM module:`, error);
          } finally {
            isBuilding = false;
            if (needsRebuild) {
              needsRebuild = false;
              buildWasm();
            }
          }
        };

        build.onStart(() => {
          buildWasm();
        });

        if (process.env['BUILD_MODE'] === 'dev') {
          watcher = chokidar.watch([
            'abxml-wrapper/src/**/*.rs',
            'abxml-rs/src/**/*.rs',
            'abxml-wrapper/Cargo.toml',
            'abxml-rs/Cargo.toml'
          ], {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            awaitWriteFinish: {
              stabilityThreshold: 300,
              pollInterval: 100
            }
          });

          watcher
            .on('change', path => {
              console.log(`Rust file changed: ${path}`);
              buildWasm();
            })
            .on('error', error => console.error(`Watcher error: ${error}`));
        }
      }
    },
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
