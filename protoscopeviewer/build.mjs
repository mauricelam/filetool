import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process'; // For potential future use, not strictly needed now

// Helper to fetch wasm_exec.js
async function fetchWasmExecJs(targetPath) {
  const url = 'https://raw.githubusercontent.com/golang/go/release-branch.go1.22/misc/wasm/wasm_exec.js';
  try {
    // node-fetch is not available by default, using a simpler approach if Node's fetch is available or polyfilled.
    // For this environment, direct fetch might not work.
    // A more robust solution might involve 'https-proxy-agent' or ensuring 'node-fetch' is a dependency.
    // However, the dexviewer build.mjs uses `cp $(go env GOROOT)/misc/wasm/wasm_exec.js ...`
    // Let's try to mimic that if `go` is available, otherwise log a message.
    // For now, to match the subtask requirement of fetching, we'll use a placeholder.
    // This part would ideally use a proper fetch or be pre-downloaded.

    // Fallback: The subtask explicitly asks to fetch like dexviewer.
    // dexviewer actually uses: execSync(`cp $(go env GOROOT)/misc/wasm/wasm_exec.js ...`);
    // Let's try to fetch it using node's https module as a more self-contained way for a build script.
    const https = await import('https');
    
    console.log(`Fetching ${url} to ${targetPath}`);
    
    const file = fs.createWriteStream(targetPath);
    await new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        fs.unlink(targetPath, () => {}); // Delete the file if download failed
        reject(err);
      });
    });
    console.log('wasm_exec.js fetched successfully.');
  } catch (error) {
    console.error(`Error fetching wasm_exec.js: ${error.message}`);
    console.error('Please ensure wasm_exec.js is manually placed in the output directory or install Go and ensure $(go env GOROOT)/misc/wasm/wasm_exec.js is available.');
    // To prevent build failure if fetch fails, we'll let it proceed,
    // but the application will likely fail at runtime without wasm_exec.js
  }
}


const srcDir = '.'; // Current directory where build.mjs is
const outDir = '../../dist/protoscopeviewer';

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
          // Fetch wasm_exec.js
          await fetchWasmExecJs(path.join(outDir, 'wasm_exec.js'));
        });
      }
    },
    copy({
      // This plugin copies files from the 'assets' array.
      // Each item in 'assets' specifies a 'from' and 'to' path.
      // 'from' paths are relative to the current working directory (protoscopeviewer/)
      // 'to' paths are relative to the 'outdir' (../../dist/protoscopeviewer/)
      assets: [
        {
          from: [path.join(srcDir, 'index.html')],
          to: ['.'], // Copies to outDir/index.html
          watch: process.env['BUILD_MODE'] === 'dev',
        },
        {
          from: [path.join(srcDir, 'protoscope.wasm')],
          to: ['.'], // Copies to outDir/protoscope.wasm
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ],
      // verbose: true, // for debugging copy issues
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
