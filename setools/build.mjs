import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import process from 'process';
import path from 'path';
import fs from 'fs';
import { emscriptenWasm } from '../esbuild-plugins/emscripten-wasm.mjs';

const projectDir = process.cwd();
const buildDir = path.join(projectDir, 'build');
const libsepolA = path.join(buildDir, 'libsepol.a');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

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
      command: `make -C selinux/libsepol/src -f Makefile CC=emcc AR=emar RANLIB=emranlib CFLAGS="-O2 -Wall -DHAVE_REALLOCARRAY -D_GNU_SOURCE -I../cil/include" LD_SONAME_FLAGS="" LIBA="${libsepolA}" DISABLE_SHARED=y DISABLE_CIL=y && emcc -O2 -Wall -DHAVE_REALLOCARRAY -D_GNU_SOURCE -Iselinux/libsepol/include -Iselinux/libsepol/src -Iselinux/libsepol/cil/include -c selinux/libsepol/src/wasm_compat.c -o build/wasm_compat.o && emar r "${libsepolA}" build/wasm_compat.o && emranlib "${libsepolA}" && emcc policy_api.c "${libsepolA}" -Iselinux/libsepol/include -o ../dist/setools/sepolicy.js -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME="createSepolicyModule" -s EXPORT_ES6=1 -s ENVIRONMENT=web -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "HEAPU32", "HEAPU8", "UTF8ToString"]' -s EXPORTED_FUNCTIONS='["_malloc", "_free", "_api_load_policy", "_api_free_policy", "_api_get_version", "_api_get_symbol_count", "_api_get_symbol_name", "_api_get_rule_count", "_api_get_rules", "_api_is_type_attribute", "_api_get_boolean_state", "_api_get_permissions", "_api_free_string"]' -O3`,
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
