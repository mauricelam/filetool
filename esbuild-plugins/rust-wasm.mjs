import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { glob } from 'glob';
import lockfile from 'proper-lockfile';

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

// Helper to run a command as a promise with inherited stdio
const runCommand = (command, args, options) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit', ...options });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command "${command} ${args.join(' ')}" failed with code ${code}`));
    });
    proc.on('error', reject);
  });
};

// Helper function to ensure directory exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const rustWasm = (options) => {
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

      const buildWasm = async () => {
        if (isBuilding) {
          needsRebuild = true;
          return;
        }
        isBuilding = true;

        const cargoLockPath = path.join(projectDir, 'Cargo.lock');

        // Ensure Cargo.lock exists since proper-lockfile requires a file/dir to exist
        if (!fs.existsSync(cargoLockPath)) {
          fs.writeFileSync(cargoLockPath, '');
        }

        let release = null;
        try {
          release = await lockfile.lock(cargoLockPath, {
            stale: 30000, // 30 seconds
            update: 5000, // Update every 5 seconds
            retries: {
              retries: 200,
              minTimeout: 100,
              maxTimeout: 1000,
              factor: 1.1
            }
          });

          try {
            await runCommand('wasm-pack', ['--quiet', 'build', projectDir, '--target', 'web', '--out-name', outName]);

            // Ensure the output directory exists
            ensureDir(outDir);

            // Copy artifacts from pkg/ to outDir
            const pkgDir = path.join(projectDir, 'pkg');

            // Copy all .wasm, .js and .d.ts files
            const files = glob.sync('*.{wasm,js,d.ts}', { cwd: pkgDir });
            files.forEach(file => {
              const sourcePath = path.join(pkgDir, file);
              const destPath = path.join(outDir, file);
              fs.copyFileSync(sourcePath, destPath);
            });
          } finally {
            if (release) {
              await release();
            }
          }
        } catch (error) {
          console.error(`[rust-wasm-pack] Build failed for ${outName}:`, error);
        } finally {
          isBuilding = false;
          if (needsRebuild) {
            needsRebuild = false;
            await buildWasm(); // Trigger rebuild if changes occurred during the build
          }
        }
      };

      // Create debounced version of buildWasm
      const debouncedBuild = debounce(buildWasm, 500);

      // Initial build
      build.onStart(async () => {
        await buildWasm();
      });

      // Setup watcher in dev mode
      if (process.env['BUILD_MODE'] === 'dev') {
        const fullWatchPaths = watchPaths.map(p => path.join(projectDir, p));
        watcher = chokidar.watch(fullWatchPaths, {
          ignored: [
          ],
          persistent: true,
          awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100
          }
        });

        watcher
          .on('add', filePath => {
            debouncedBuild();
          })
          .on('change', filePath => {
            debouncedBuild();
          })
          .on('unlink', filePath => {
            debouncedBuild();
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
