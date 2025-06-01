import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { goWasm } from '../esbuild-plugins/go-wasm.mjs'; // Import the new plugin


const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: '../dist/protoscope',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['require', 'fs', 'path'],
  plugins: [
    goWasm({
      projectDir: '.',
      // main.go is directly in projectDir, so no subpath needed for build command.
      // The plugin's default goBuildCommand builds sources in projectDir.
      outWasmFile: 'protoscope.wasm', // Output file name in the esbuild outdir
      watchPaths: ['main.go', 'go.mod'] // Relative to projectDir
    }),
    copy({
      assets: [
        {
          from: 'index.html',
          to: 'index.html', // Relative to esbuild's outdir
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
      await ctx.watch();
      console.log('Watching for changes in protoscope build...');
    } else {
      await esbuild.build({ ...SETTINGS, minify: true });
      console.log('Protoscope build completed successfully.');
    }
  } catch (err) {
    console.error('Protoscope build failed:', err);
    process.exit(1);
  }
}

runBuild();
