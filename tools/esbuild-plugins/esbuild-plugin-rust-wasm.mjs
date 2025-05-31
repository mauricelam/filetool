import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

export const esbuildPluginRustWasm = (options) => {
  return {
    name: 'rust-wasm-pack',
    setup(build) {
      const { projectDir, outName, watchPaths = ['src/**/*.rs', 'Cargo.toml'] } = options;
      const outDir = build.initialOptions.outdir;

      if (!projectDir || !outName) {
        throw new Error('[rust-wasm-pack] projectDir and outName options are required.');
      }
      if (!outDir) {
        throw new Error('[rust-wasm-pack] esbuild outdir must be set.');
      }

      let isBuilding = false;
      let needsRebuild = false;
      let watcher = null;

      const buildWasm = () => {
        if (isBuilding) {
          needsRebuild = true;
          return;
        }
        isBuilding = true;
        console.log(`[rust-wasm-pack] Building ${outName} from ${projectDir}...`);
        try {
          execSync(`wasm-pack build "${projectDir}" --target web --out-name "${outName}" --out-dir "${path.join(projectDir, 'pkg')}"`, {
            stdio: 'inherit',
            cwd: projectDir // Ensure wasm-pack runs in the project directory context if needed, though absolute path to projectDir should be fine.
          });
          fs.mkdirSync(outDir, { recursive: true });
          const wasmFileSource = path.join(projectDir, 'pkg', `${outName}.wasm`);
          const wasmFileDest = path.join(outDir, `${outName}.wasm`);
          const jsFileSource = path.join(projectDir, 'pkg', `${outName}.js`);
          const jsFileDest = path.join(outDir, `${outName}.js`);

          if (fs.existsSync(wasmFileSource)) {
            fs.copyFileSync(wasmFileSource, wasmFileDest);
            console.log(`[rust-wasm-pack] Copied ${wasmFileSource} to ${wasmFileDest}`);
          } else {
            console.error(`[rust-wasm-pack] Wasm file ${wasmFileSource} not found after build.`);
          }
          if (fs.existsSync(jsFileSource)) {
            fs.copyFileSync(jsFileSource, jsFileDest);
            console.log(`[rust-wasm-pack] Copied ${jsFileSource} to ${jsFileDest}`);
          } else {
            console.error(`[rust-wasm-pack] JS file ${jsFileSource} not found after build.`);
          }

        } catch (error) {
          console.error(`[rust-wasm-pack] Failed to build Wasm module ${outName}:`, error);
        } finally {
          isBuilding = false;
          if (needsRebuild) {
            needsRebuild = false;
            buildWasm(); // Trigger rebuild if changes occurred during the build
          }
        }
      };

      // Initial build
      build.onStart(() => {
        buildWasm();
      });

      // Setup watcher in dev mode
      if (process.env['BUILD_MODE'] === 'dev') {
        const fullWatchPaths = watchPaths.map(p => path.join(projectDir, p));
        watcher = chokidar.watch(fullWatchPaths, {
          ignored: /(^|[\/\])\../, // ignore dotfiles
          persistent: true,
          awaitWriteFinish: {
            stabilityThreshold: 300,
            pollInterval: 100
          }
        });

        watcher
          .on('add', filePath => {
            console.log(`[rust-wasm-pack] File added: ${filePath}, rebuilding ${outName}...`);
            buildWasm();
          })
          .on('change', filePath => {
            console.log(`[rust-wasm-pack] File changed: ${filePath}, rebuilding ${outName}...`);
            buildWasm();
          })
          .on('unlink', filePath => {
            console.log(`[rust-wasm-pack] File deleted: ${filePath}, rebuilding ${outName}...`);
            buildWasm();
          })
          .on('error', error => console.error(`[rust-wasm-pack] Watcher error for ${outName}: ${error}`));

        // Clean up watcher on build end/dispose
        build.onDispose(() => {
          if (watcher) {
            watcher.close();
          }
        });
      }
    }
  };
};

// Ensure tools/esbuild-plugins directory exists
const pluginsDir = 'tools/esbuild-plugins';
if (!fs.existsSync(pluginsDir)) {
  fs.mkdirSync(pluginsDir, { recursive: true });
}
