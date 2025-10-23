# SQLite viewer notes

This folder contains a Web Worker that loads the `@sqlite.org/sqlite-wasm` runtime and exposes a minimal message API (`init`, `open`, `getTables`, `exec`).

#### Important notes for maintainers

- The sqlite-wasm project deprecated `sqlite3_js_vfs_create_file()` in favor of `sqlite3_js_posix_create_file()` (see release notes 2023-08-12). The relevant cookbook entry is:
  https://sqlite.org/wasm/doc/trunk/cookbook.md#uldl

- The worker (`sqlite.worker.ts`) prefers the posix-style helper (`sqlite3_js_posix_create_file`) when available, falls back to `sqlite3__wasm_posix_create_file`, and only uses the older `sqlite3_js_vfs_create_file` as a last resort. This maximizes compatibility across different bundled builds while avoiding the deprecated API when possible.

- OPFS (persistent Origin Private File System) support requires cross-origin isolation (COOP/COEP headers). If you want OPFS enabled for persistent storage, configure your server to send the appropriate headers and re-build/serve the app under cross-origin isolation.

- If you run into runtime TypeErrors about missing functions, check the built bundle in `dist/sqliteviewer/sqlite.worker.js` to see which helper names were exported; update the worker's probing order if the library introduces new preferred helpers.
