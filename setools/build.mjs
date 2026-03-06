import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import { emscriptenWasm } from '../esbuild-plugins/emscripten-wasm.mjs';

const SETTINGS = {
  entryPoints: ['main.tsx', 'worker.ts'],
  outdir: "../dist/setools",
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ['require', 'fs', 'path', 'node:fs', 'node:path', 'node:crypto'],
  plugins: [
    copy({
      assets: [
        {
          from: ["index.html"],
          to: ["index.html"],
        }
      ]
    }),
    emscriptenWasm({
      name: 'sepolicy',
      projectDir: '.',
      command: 'mkdir -p build && make -C selinux/libsepol -f Makefile.wasm DISABLE_CIL=y LIBSEPOL_A=$(pwd)/build/libsepol.a && emcc policy_api.c build/libsepol.a -Iselinux/libsepol/include -o ../dist/setools/sepolicy.js -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME="createSepolicyModule" -s EXPORT_ES6=1 -s ENVIRONMENT=web -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS=\'["ccall", "cwrap", "HEAPU32", "HEAPU8", "UTF8ToString"]\' -s EXPORTED_FUNCTIONS=\'["_malloc", "_free", "_api_load_policy", "_api_free_policy", "_api_get_version", "_api_get_symbol_count", "_api_get_symbol_name", "_api_get_rule_count", "_api_get_rules", "_api_is_type_attribute", "_api_get_boolean_state", "_api_get_permissions", "_api_free_string"]\' -O3',
      watchFiles: ['policy_api.c', 'selinux/libsepol/src/**/*.c', 'selinux/libsepol/include/**/*.h']
    }),
    {
      name: 'resolve-sepolicy',
      setup(build) {
        build.onResolve({ filter: /^\.\/sepolicy\.js$/ }, args => {
          return { path: './sepolicy.js', external: true }
        })
      },
    },
  ],
  loader: {
    '.css': 'css',
  }
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
