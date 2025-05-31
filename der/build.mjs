import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatchMode = process.env.BUILD_MODE === 'dev';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/der",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    {
      name: 'build-wasm',
      setup: (build) => {
        build.onStart(async () => {
          const distDir = resolve(__dirname, '..', 'dist', 'der');
          if (!existsSync(distDir)) {
            mkdirSync(distDir, { recursive: true });
          }
          execSync(`cd wasm && GOOS=js GOARCH=wasm go build -o ${distDir}/der.wasm main.go && cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" ${distDir}/`, { stdio: 'inherit' });
        });
      }
    },
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: isWatchMode,
        },
      ]
    }),
  ],
}

if (isWatchMode) {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
  });
  console.log('Watching for changes...');
  await ctx.watch();
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
  console.log('Build completed successfully');
} 