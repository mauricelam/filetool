import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Helper to fetch wasm_exec.js
async function fetchWasmExecJs(targetPath) {
  try {
    // Try to get the local Go root
    const goRoot = execSync('go env GOROOT').toString().trim();
    const localWasmExec = path.join(goRoot, 'misc', 'wasm', 'wasm_exec.js');
    if (!fs.existsSync(localWasmExec)) {
      throw new Error(`wasm_exec.js not found at ${localWasmExec}`);
    }
    fs.copyFileSync(localWasmExec, targetPath);
    console.log(`Copied wasm_exec.js from local Go installation: ${localWasmExec} -> ${targetPath}`);
  } catch (error) {
    console.error(`Error copying wasm_exec.js from local Go installation: ${error.message}`);
    console.error('Please ensure Go is installed and $(go env GOROOT)/misc/wasm/wasm_exec.js is available.');
    process.exit(1);
  }
}


const srcDir = '.'; // Current directory where build.mjs is
const outDir = '../dist/protoscope';

// Function to build Go code to WASM
function buildGoCode() {
  try {
    console.log('Building Go code to WASM...');
    execSync(`GOOS=js GOARCH=wasm go build -o ${path.join(outDir, 'protoscope.wasm')} main.go`, { stdio: 'inherit' });
    console.log('Go code built successfully.');
  } catch (error) {
    console.error('Error building Go code:', error.message);
    process.exit(1);
  }
}

const SETTINGS = {
  entryPoints: [path.join(srcDir, 'main.tsx')],
  outdir: outDir,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['require', 'fs', 'path'], // Standard externals
  plugins: [
    {
      name: 'prepare-output-dir',
      setup: (build) => {
        build.onStart(async () => {
          // Ensure output directory exists
          if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
          }
          // Build Go code to WASM
          buildGoCode();
          // Fetch wasm_exec.js
          await fetchWasmExecJs(path.join(outDir, 'wasm_exec.js'));
        });
      }
    },
    copy({
      assets: [
        {
          from: 'index.html',
          to: 'index.html',
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ],
    }),
  ],
};

async function runBuild() {
  try {
    if (process.env['BUILD_MODE'] === 'dev') {
      const ctx = await esbuild.context({
        ...SETTINGS,
        sourcemap: true,
      });
      
      // Watch for changes in main.go
      fs.watch('main.go', (eventType) => {
        if (eventType === 'change') {
          console.log('main.go changed, rebuilding WASM...');
          buildGoCode();
        }
      });
      
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build({ ...SETTINGS, minify: true });
      console.log('Build completed successfully.');
    }
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

runBuild();
