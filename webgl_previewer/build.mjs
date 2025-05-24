import esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';
import process from 'process'; // Import process

const outDir = 'dist';

const SETTINGS = {
    entryPoints: ['main.ts'],
    bundle: true,
    outfile: path.join(outDir, 'bundle.js'),
    format: 'iife',
    platform: 'browser',
    logLevel: 'info',
};

async function build() {
    try {
        await fs.mkdir(outDir, { recursive: true });

        if (process.env['BUILD_MODE'] === 'dev') {
            const ctx = await esbuild.context({
                ...SETTINGS,
                sourcemap: true,
            });
            console.log('Watching for changes...');
            await ctx.watch();
        } else {
            const result = await esbuild.build({
                ...SETTINGS,
                minify: true,
                sourcemap: true, // Keep sourcemap for prod bundle too
            });
            if (result.errors.length > 0) {
                console.error('Build failed with errors:', result.errors);
                process.exit(1);
            }
            if (result.warnings.length > 0) {
                console.warn('Build completed with warnings:', result.warnings);
            }
            console.log('Build successful!');
        }
    } catch (error) {
        console.error('Build script error:', error);
        process.exit(1);
    }
}

build();
