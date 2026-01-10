import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yauzl from 'yauzl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function extractZip(zipPath, extractTo) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          const dirPath = path.join(extractTo, entry.fileName);
          fs.mkdirSync(dirPath, { recursive: true });
          zipfile.readEntry();
        } else {
          // File entry
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);

            const filePath = path.join(extractTo, entry.fileName);
            const dirPath = path.dirname(filePath);
            fs.mkdirSync(dirPath, { recursive: true });

            const writeStream = fs.createWriteStream(filePath);
            readStream.pipe(writeStream);
            writeStream.on('close', () => {
              zipfile.readEntry();
            });
          });
        }
      });

      zipfile.on('end', () => resolve());
      zipfile.on('error', reject);
    });
  });
}


const SETTINGS = {
  entryPoints: ['main.tsx'],
  outdir: "../dist/cyberchef",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ]
    }),
    {
      name: 'extract-cyberchef-zip',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length > 0) {
            return; // Don't extract if build failed
          }

          try {
            await extractZip(
              path.join(__dirname, 'CyberChef_v10.19.4.zip'),
              path.resolve(__dirname, build.initialOptions.outdir, 'CyberChef')
            );
            console.log(`Extracted CyberChef zip to ${path.resolve(__dirname, build.initialOptions.outdir, 'CyberChef')}`);
          } catch (error) {
            console.error('Failed to extract CyberChef zip:', error);
          }
        });
      },
    },
  ],
}

if (process.env['BUILD_MODE'] === 'dev') {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
  });
  await ctx.watch();
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
}
