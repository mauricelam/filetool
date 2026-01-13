import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

// 1. Create output directory
const outdir = 'dist/sepolicy';
mkdirSync(outdir, { recursive: true });

// 2. Compile C code with Emscripten
const sepolSrc = [
    "sepolicy/selinux/libsepol/src/assertion.c",
    "sepolicy/selinux/libsepol/src/avrule_block.c",
    "sepolicy/selinux/libsepol/src/avtab.c",
    "sepolicy/selinux/libsepol/src/conditional.c",
    "sepolicy/selinux/libsepol/src/constraint.c",
    "sepolicy/selinux/libsepol/src/context.c",
    "sepolicy/selinux/libsepol/src/debug.c",
    "sepolicy/selinux/libsepol/src/ebitmap.c",
    "sepolicy/selinux/libsepol/src/expand.c",
    "sepolicy/selinux/libsepol/src/hashtab.c",
    "sepolicy/selinux/libsepol/src/interfaces.c",
    "sepolicy/selinux/libsepol/src/kernel_to_cil.c",
    "sepolicy/selinux/libsepol/src/link.c",
    "sepolicy/selinux/libsepol/src/module.c",
    "sepolicy/selinux/libsepol/src/nodes.c",
    "sepolicy/selinux/libsepol/src/ports.c",
    "sepolicy/selinux/libsepol/src/policydb.c",
    "sepolicy/selinux/libsepol/src/policydb_convert.c",
    "sepolicy/selinux/libsepol/src/policydb_public.c",
    "sepolicy/selinux/libsepol/src/services.c",
    "sepolicy/selinux/libsepol/src/sidtab.c",
    "sepolicy/selinux/libsepol/src/symtab.c",
    "sepolicy/selinux/libsepol/src/users.c",
    "sepolicy/selinux/libsepol/src/util.c",
    "sepolicy/selinux/libsepol/src/write.c",
    "sepolicy/selinux/libsepol/src/mls.c",
    "sepolicy/selinux/libsepol/src/policydb_validate.c",
    "sepolicy/selinux/libsepol/src/polcaps.c",
];
const selinuxSrc = [
    "sepolicy/selinux/libselinux/src/avc.c",
    "sepolicy/selinux/libselinux/src/avc_sidtab.c",
    "sepolicy/selinux/libselinux/src/booleans.c",
    "sepolicy/selinux/libselinux/src/canonicalize_context.c",
    "sepolicy/selinux/libselinux/src/check_context.c",
    "sepolicy/selinux/libselinux/src/disable.c",
    "sepolicy/selinux/libselinux/src/enabled.c",
    "sepolicy/selinux/libselinux/src/fgetfilecon.c",
    "sepolicy/selinux/libselinux/src/fsetfilecon.c",
    "sepolicy/selinux/libselinux/src/freecon.c",
    "sepolicy/selinux/libselinux/src/getfilecon.c",
    "sepolicy/selinux/libselinux/src/getenforce.c",
    "sepolicy/selinux/libselinux/src/getpeercon.c",
    "sepolicy/selinux/libselinux/src/lgetfilecon.c",
    "sepolicy/selinux/libselinux/src/lsetfilecon.c",
    "sepolicy/selinux/libselinux/src/mapping.c",
    "sepolicy/selinux/libselinux/src/matchpathcon.c",
    "sepolicy/selinux/libselinux/src/policyvers.c",
    "sepolicy/selinux/libselinux/src/selinux_config.c",
    "sepolicy/selinux/libselinux/src/setenforce.c",
    "sepolicy/selinux/libselinux/src/setfilecon.c",
    "sepolicy/selinux/libselinux/src/seusers.c",
    "sepolicy/selinux/libselinux/src/sha1.c",
    "sepolicy/selinux/libselinux/src/stringrep.c",
    "sepolicy/selinux/libselinux/src/callbacks.c",
    "sepolicy/selinux/libselinux/src/label.c",
];

const sourceFiles = [
    'sepolicy/sepolicy/tools/sepolicy-check.c',
    ...sepolSrc,
    ...selinuxSrc,
];

const includePaths = [
    'sepolicy/shims',
    'sepolicy/selinux/libsepol/include',
    'sepolicy/selinux/libselinux/include',
];

const emccCommand = [
    `/app/emsdk/upstream/emscripten/emcc -w`,
    `-o ${outdir}/sepolicy.js`,
    ...sourceFiles,
    ...includePaths.map(p => `-I${p}`),
    '-D_GNU_SOURCE',
    '-DNO_PCRE',
    '-s MODULARIZE=1',
    '-s EXPORT_ES6=1',
    '-s EXPORTED_RUNTIME_METHODS=[\'FS\',\'callMain\']',
    '-s ALLOW_MEMORY_GROWTH=1',
].join(' ');

try {
    console.log('Compiling sepolicy tools with Emscripten...');
    execSync(emccCommand, { stdio: 'inherit' });
    console.log('Emscripten compilation successful.');
} catch (e) {
    console.error('Emscripten compilation failed:', e);
    if (process.env['BUILD_MODE'] !== 'dev') {
        process.exit(1);
    }
}


// 3. Build frontend code with esbuild
const SETTINGS = {
  entryPoints: ['sepolicy/main.tsx', 'sepolicy/worker.ts'],
  outdir,
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path'],
  plugins: [
    copy({
      assets: [
        {
          from: ["sepolicy/index.html"],
          to: ["index.html"],
          watch: process.env['BUILD_MODE'] === 'dev',
        },
      ]
    }),
  ],
  loader: {
    '.css': 'css',
  }
};

if (process.env['BUILD_MODE'] === 'dev') {
  const ctx = await esbuild.context({
    ...SETTINGS,
    sourcemap: true,
  });
  await ctx.watch();
} else {
  await esbuild.build({ ...SETTINGS, minify: true });
}
