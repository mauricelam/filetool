import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { execSync } from 'child_process';
import { watch } from 'fs';

const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/dexviewer",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    {
      name: 'build-wasm',
      setup: (build) => {
        build.onStart(async () => {
          execSync(`cp $(go env GOROOT)/misc/wasm/wasm_exec.js ${build.initialOptions.outdir}/wasm_exec.js`);
          execSync(`cd godexviewer && GOOS=js GOARCH=wasm go build -o ../${build.initialOptions.outdir}/dextk.wasm`);
        });

        if (process.env['BUILD_MODE'] === 'dev') {
          watch('./godexviewer', { recursive: true }, (eventType, filename) => {
            try {
              execSync(`cd godexviewer && GOOS=js GOARCH=wasm go build -o ../${build.initialOptions.outdir}/dextk.wasm`);
            } catch (err) {
              console.error('Failed to build Go wasm:', err.message);
            }
          });
        }
      }
    },
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ]
    }),
  ],
}

if (process.env['BUILD_MODE'] === 'dev') {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
    // banner: {
    //   js: `new EventSource('/esbuild').addEventListener('change', () => location.reload()); `,
    // },
  });
  await ctx.watch();
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
}
