import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

export const goWasm = (options) => {
  return {
    name: 'go-wasm-builder',
    setup(build) {
      const {
        projectDir,
        goBuildCommand = 'GOOS=js GOARCH=wasm go build -o',
        outWasmFile, // e.g., 'module.wasm' relative to esbuild outdir
        wasmExecJsDest = 'wasm_exec.js', // relative to esbuild outdir
        watchPaths = ['**/*.go', 'go.mod'] // paths relative to projectDir
      } = options;
      const outDir = build.initialOptions.outdir;

      if (!projectDir || !outWasmFile) {
        throw new Error('[go-wasm-builder] projectDir and outWasmFile options are required.');
      }
      if (!outDir) {
        throw new Error('[go-wasm-builder] esbuild outdir must be set.');
      }

      let isBuilding = false;
      let needsRebuild = false;
      let watcher = null;
      let goRoot = '';

      goRoot = execSync('go env GOROOT', { encoding: 'utf-8' }).trim();

      const wasmExecJsSrc = path.join(goRoot, 'misc', 'wasm', 'wasm_exec.js');

      const buildWasm = () => {
        if (isBuilding) {
          needsRebuild = true;
          return;
        }
        isBuilding = true;
        console.log(`[go-wasm-builder] Building Go Wasm module from ${projectDir}...`);

        const absoluteOutWasmPath = path.resolve(outDir, outWasmFile);
        const fullBuildCommand = `${goBuildCommand} "${absoluteOutWasmPath}"`;

        try {
          // Ensure the output directory exists
          fs.mkdirSync(path.resolve(outDir), { recursive: true });
          
          // Run the build command from the project directory
          execSync(fullBuildCommand, { stdio: 'inherit', cwd: projectDir });
          console.log(`[go-wasm-builder] Successfully built ${outWasmFile}`);

          // Copy wasm_exec.js
          if (fs.existsSync(wasmExecJsSrc)) {
            const absoluteWasmExecJsDest = path.join(outDir, wasmExecJsDest);
            fs.mkdirSync(path.dirname(absoluteWasmExecJsDest), { recursive: true });
            fs.copyFileSync(wasmExecJsSrc, absoluteWasmExecJsDest);
            console.log(`[go-wasm-builder] Copied ${wasmExecJsSrc} to ${absoluteWasmExecJsDest}`);
          } else {
            console.warn(`[go-wasm-builder] wasm_exec.js not found at ${wasmExecJsSrc}. Skipping copy.`);
          }
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
        const fullWatchPaths = watchPaths.map(p => path.join(projectDir, p));
        watcher = chokidar.watch(fullWatchPaths, {
          ignored: /^(?!.*\.go$).*$/,
          persistent: true,
          awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100
          }
        });

        watcher
          .on('add', filePath => {
            console.log(`[go-wasm-builder] File added: ${filePath}, rebuilding...`);
            buildWasm();
          })
          .on('change', filePath => {
            console.log(`[go-wasm-builder] File changed: ${filePath}, rebuilding...`);
            buildWasm();
          })
          .on('unlink', filePath => {
            console.log(`[go-wasm-builder] File deleted: ${filePath}, rebuilding...`);
            buildWasm();
          })
          .on('error', error => console.error(`[go-wasm-builder] Watcher error: ${error}`));

        build.onDispose(() => {
          if (watcher) {
            watcher.close();
          }
        });
      }
    }
  };
};
