import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { SqliteWorkerMessage } from './messages';

let sqlite3: any;
let db: any;

const start = function (s3: any) {
    sqlite3 = s3;
    self.postMessage({ type: 'init', success: true });
};

sqlite3InitModule({
    print: console.log,
    printErr: console.error,
}).then((s3: any) => {
    try {
        start(s3);
    } catch (err: unknown) {
        console.error('sqlite.worker: start() threw', err);
        self.postMessage({ type: 'init', success: false, error: err instanceof Error ? err.message : String(err) });
    }
}).catch((err: unknown) => {
    console.error('sqlite.worker: sqlite3InitModule failed', err);
    self.postMessage({ type: 'init', success: false, error: err instanceof Error ? err.message : String(err) });
});

self.onmessage = async (e: MessageEvent<SqliteWorkerMessage>) => {
    // handle incoming messages from main thread
    const { type } = e.data;

    switch (type) {
        case 'open':
            if (!sqlite3) {
                console.warn('sqlite.worker: open requested but sqlite3 not initialized', { sqlite3Initialized: !!sqlite3 });
                self.postMessage({ type: 'open', success: false, error: 'SQLite not initialized', sqlite3Initialized: !!sqlite3 });
                return;
            }
            try {
                const buffer = await e.data.file.arrayBuffer();
                const u8 = new Uint8Array(buffer);

                // Prefer the new posix-style helper per sqlite-wasm release notes
                // (2023-08-12) which deprecates sqlite3_js_vfs_create_file in favor
                // of sqlite3_js_posix_create_file for the default VFS. See the
                // cookbook: https://sqlite.org/wasm/doc/trunk/cookbook.md#uldl
                // We still probe several candidates for compatibility with older
                // or alternative builds.
                if (sqlite3 && sqlite3.capi && typeof sqlite3.capi.sqlite3_js_posix_create_file === 'function') {
                    // signature: (filename, data, dataLen)
                    sqlite3.capi.sqlite3_js_posix_create_file('db.sqlite', u8, u8.byteLength);
                } else if (sqlite3 && sqlite3.util && typeof sqlite3.util.sqlite3__wasm_posix_create_file === 'function') {
                    // signature: (filename, data, dataLen)
                    sqlite3.util.sqlite3__wasm_posix_create_file('db.sqlite', u8, u8.byteLength);
                } else if (sqlite3 && sqlite3.capi && typeof sqlite3.capi.sqlite3_js_vfs_create_file === 'function') {
                    // signature: (vfs, filename, data, dataLen)
                    sqlite3.capi.sqlite3_js_vfs_create_file(null, 'db.sqlite', u8, u8.byteLength);
                } else if (sqlite3 && sqlite3.capi && typeof sqlite3.capi.sqlite3__wasm_vfs_create_file === 'function') {
                    // signature: (vfs, filename, data, dataLen)
                    sqlite3.capi.sqlite3__wasm_vfs_create_file(null, 'db.sqlite', u8, u8.byteLength);
                } else {
                    throw new Error('No suitable sqlite create-file API found on sqlite3 object');
                }

                // After attempting to materialize the file in the VFS, log VFS list
                let vfsList: string[] | null = null;
                try {
                    vfsList = sqlite3 && sqlite3.capi && typeof sqlite3.capi.sqlite3_js_vfs_list === 'function'
                        ? sqlite3.capi.sqlite3_js_vfs_list()
                        : null;
                } catch (e) {
                    console.warn('sqlite.worker: error retrieving vfsList', e instanceof Error ? e.message : String(e));
                }

                // If a suitable VFS is available, try opening the DB with that VFS explicitly.
                // This avoids cases where the create-file helper wrote to a different VFS than
                // the DB constructor would use by default.
                const preferredVfs = Array.isArray(vfsList) && vfsList.includes('unix') ? 'unix' : (Array.isArray(vfsList) && vfsList.length ? vfsList[0] : null);
                if (preferredVfs) {
                    try {
                        db = new sqlite3.oo1.DB({ filename: 'db.sqlite', vfs: preferredVfs });
                    } catch (e) {
                        console.warn('sqlite.worker: explicit-vfs DB open failed, falling back to default open', e instanceof Error ? e.message : String(e));
                        db = new sqlite3.oo1.DB('db.sqlite');
                    }
                } else {
                    db = new sqlite3.oo1.DB('db.sqlite');
                }
                self.postMessage({ type: 'open', success: true });
            } catch (err: unknown) {
                console.error('sqlite.worker: error opening DB from file', err);
                self.postMessage({ type: 'open', success: false, error: err instanceof Error ? err.message : String(err) });
            }
            break;
        case 'getTables':
            if (!db) {
                console.warn('sqlite.worker: getTables requested but DB not open');
                self.postMessage({ type: 'getTables', error: 'Database not open' });
                return;
            }
            try {
                const tables = db.exec({
                    sql: "SELECT name FROM sqlite_master WHERE type='table'",
                    returnValue: "resultRows",
                    rowMode: 'array'
                });
                self.postMessage({ type: 'getTables', tables });
            } catch (err: unknown) {
                console.error('sqlite.worker: error running getTables', err);
                // Return an empty tables array to the main thread to avoid callers
                // attempting to map over `undefined` and throwing TypeErrors.
                self.postMessage({ type: 'getTables', error: err instanceof Error ? err.message : String(err), tables: [] });
            }
            break;
        case 'exec':
            if (!db) {
                console.warn('sqlite.worker: exec requested but DB not open');
                self.postMessage({ type: 'exec', error: 'Database not open' });
                return;
            }
            try {
                // executing SQL (query text suppressed to avoid noisy logs)
                const result = db.exec({
                    sql: e.data.sql,
                    returnValue: "resultRows",
                    rowMode: 'object'
                });

                if (result.length === 0) {
                    self.postMessage({ type: 'exec', results: [], columns: [] });
                    return;
                }

                const columns = Object.keys(result[0]).map(key => ({ Header: key, accessor: key }));
                self.postMessage({ type: 'exec', results: result, columns });
            } catch (err: unknown) {
                console.error('sqlite.worker: exec error', err);
                self.postMessage({ type: 'exec', error: err instanceof Error ? err.message : String(err) });
            }
            break;
    }
};