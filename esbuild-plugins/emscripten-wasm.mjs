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

/**
 * esbuild plugin to build and manage Emscripten WebAssembly modules.
 *
 * This plugin runs a specified build command (e.g., `make`) to produce WASM artifacts,
 * and can optionally manage the resolution of these artifacts within the bundle.
 *
 * @param {Object} options - Plugin options.
 * @param {string} options.name - The name of the WASM module (for logging).
 * @param {string} options.projectDir - The directory containing the C/C++ project.
 * @param {string} options.command - The shell command to run to build the WASM module.
 * @param {string[]} [options.artifacts=[]] - List of artifacts produced by the build command.
 * @param {boolean} [options.resolveArtifacts=false] - If true, the plugin will provide an `onResolve` rule for `.js` artifacts in the `artifacts` list, mapping them to their build location.
 * @param {string[]} [options.watchFiles=[]] - List of source files/patterns to watch for changes in dev mode.
 * @param {Object} [options.env={}] - Additional environment variables for the build command.
 *
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
export const emscriptenWasm = (options) => {
  return {
    name: 'emscripten-wasm',
    setup(build) {
      const {
        name,
        projectDir,
        command,
        artifacts = [],
        resolveArtifacts = false,
        watchFiles = [],
        env = {}
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
            env: {
              ...process.env,
              ...env
            }
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

      if (resolveArtifacts) {
        artifacts.forEach(artifact => {
          if (artifact.endsWith('.js')) {
            const filter = new RegExp(`^\\.\\/${artifact.replace(/\./g, '\\.')}$`);
            build.onResolve({ filter }, args => {
              return { path: path.join(process.cwd(), projectDir, artifact) };
            });
          }
        });
      }

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
