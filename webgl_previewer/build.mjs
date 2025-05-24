import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';

const SETTINGS = {
    entryPoints: ['main.ts'],
    outdir: "../dist/webgl_previewer",
    bundle: true,
    format: "esm",
    platform: "browser",
    logLevel: "info",
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
    ],
};

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
        sourcemap: true,
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
