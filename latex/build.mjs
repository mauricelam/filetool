import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';

const isDev = process.env.BUILD_MODE === 'dev';

const sharedConfig = {
  entryPoints: ['main.tsx'],
  bundle: true,
  minify: !isDev,
  sourcemap: isDev,
  outdir: '../dist/latex',
  plugins: [
    copy({
      assets: [
        {
          from: ['./index.html'],
          to: ['./index.html'],
          watch: isDev
        },
        {
          from: ['./node_modules/@fontsource/fira-code/files/fira-code-latin-400-normal.woff2'],
          to: ['./fonts/fira-code.woff2'],
          watch: isDev
        }
      ],
    }),
  ],
  loader: {
    '.tsx': 'tsx',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
    '.ttf': 'dataurl',
  }
};

if (!isDev) {
  esbuild.build(sharedConfig).catch(() => process.exit(1));
} else {
  const ctx = await esbuild.context(sharedConfig);
  await ctx.watch();
  console.log('Watching for changes...');
}
