import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';

const isProduction = process.env.NODE_ENV === 'production';

const sharedConfig = {
  entryPoints: ['main.tsx'],
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  outdir: '../dist/latex',
  plugins: [
    copy({
      assets: {
        from: ['./index.html'],
        to: ['./'],
      },
    }),
  ],
  loader: {
    '.tsx': 'tsx',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
    '.ttf': 'dataurl',
  }
};

esbuild.build(sharedConfig).catch(() => process.exit(1));
