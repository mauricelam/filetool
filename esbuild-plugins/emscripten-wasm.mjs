import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { glob } from 'glob';

// Helper function to create a debounced version of a function
const debounce = (fn, delay) => {
  let timeout = null;
  return (...args) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
      timeout = null;
    }, delay);
  };
};

// Helper function to ensure directory exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const emscriptenWasm = (options) => {
  return {
    name: 'emscripten-wasm',
    setup(build) {
      const {
        name,
        projectDir,
        command,
        artifacts = [],
        watchFiles = []
      } = options;

      const outDir = build.initialOptions.outdir;

      if (!projectDir || !command) {
        throw new Error('[emscripten-wasm] projectDir and command options are required.');
      }
      if (!outDir) {
        throw new Error('[emscripten-wasm] esbuild outdir must be set.');
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
        console.log(`[emscripten-wasm] Building ${name}...`);
        try {
          // Ensure the output directory exists before running the command,
          // in case the command wants to output directly into it.
          ensureDir(outDir);

          execSync(command, {
            cwd: projectDir,
            stdio: 'inherit',
          });

          // Copy artifacts from projectDir to outDir if specified
          if (artifacts.length > 0) {
            const files = glob.sync(artifacts, { cwd: projectDir });
            files.forEach(file => {
              const sourcePath = path.join(projectDir, file);
              const destPath = path.join(outDir, file);
              fs.copyFileSync(sourcePath, destPath);
            });
          }
        } catch (e) {
          console.error(`[emscripten-wasm] Build failed for ${name}:`, e);
        } finally {
          isBuilding = false;
          if (needsRebuild) {
            needsRebuild = false;
            buildWasm();
          }
        }
      };

      const debouncedBuild = debounce(buildWasm, 500);

      build.onStart(() => {
        buildWasm();
      });

      if (watchFiles.length > 0 && process.env['BUILD_MODE'] === 'dev') {
        const fullWatchPaths = watchFiles.map(p => path.join(projectDir, p));
        watcher = chokidar.watch(fullWatchPaths, {
          persistent: true,
          awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100
          }
        });

        watcher
          .on('add', () => debouncedBuild())
          .on('change', () => debouncedBuild())
          .on('unlink', () => debouncedBuild())
          .on('error', error => console.error(`[emscripten-wasm] Watcher error for ${name}: ${error}`));

        build.onDispose(() => {
          if (watcher) {
            watcher.close();
          }
        });
      }
    }
  };
};
