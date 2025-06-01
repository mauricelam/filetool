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

      const buildWasm = () => {
        if (isBuilding) {
          needsRebuild = true;
          return;
        }
        isBuilding = true;
        console.log(`[rust-wasm-pack] Building ${outName} from ${projectDir}...`);
        try {
          execSync(`wasm-pack build "${projectDir}" --target web --out-name "${outName}"`, {
            stdio: 'inherit',
          });

          // Ensure the output directory exists
          ensureDir(outDir);

          // Copy artifacts from pkg/ to outDir
          const pkgDir = path.join(projectDir, 'pkg');

          // Copy all .wasm and .js files
          const files = glob.sync('*.{wasm,js}', { cwd: pkgDir });
          files.forEach(file => {
            const sourcePath = path.join(pkgDir, file);
            const destPath = path.join(outDir, file);
            fs.copyFileSync(sourcePath, destPath);
            console.log(`[rust-wasm-pack] Copied ${file} to ${outDir}`);
          });
        } finally {
          isBuilding = false;
          if (needsRebuild) {
            needsRebuild = false;
            buildWasm(); // Trigger rebuild if changes occurred during the build
          }
        }
      };

      // Create debounced version of buildWasm
      const debouncedBuild = debounce(buildWasm, 500);

      // Initial build
      build.onStart(() => {
        buildWasm();
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
            console.log(`[rust-wasm-pack] File added: ${filePath}, scheduling rebuild...`);
            debouncedBuild();
          })
          .on('change', filePath => {
            console.log(`[rust-wasm-pack] File changed: ${filePath}, scheduling rebuild...`);
            debouncedBuild();
          })
          .on('unlink', filePath => {
            console.log(`[rust-wasm-pack] File deleted: ${filePath}, scheduling rebuild...`);
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
