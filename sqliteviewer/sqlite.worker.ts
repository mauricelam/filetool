import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let sqlite3;
let db;

const start = function (s3) {
    sqlite3 = s3;
    console.log('Running SQLite3 version', sqlite3.version.libVersion);
    self.postMessage({ type: 'init', success: true });
};

sqlite3InitModule({
    print: console.log,
    printErr: console.error,
}).then((s3) => {
    try {
        start(s3);
    } catch (err) {
        self.postMessage({ type: 'init', success: false, error: err.message });
    }
});

self.onmessage = async (e: MessageEvent) => {
    const { type, file, sql } = e.data;

    switch (type) {
        case 'open':
            if (!sqlite3) {
                self.postMessage({ type: 'open', success: false, error: 'SQLite not initialized' });
                return;
            }
            const buffer = await file.arrayBuffer();
            const p = sqlite3.capi.sqlite3_wasm_vfs_create_file('db.sqlite', new Uint8Array(buffer), '?readwrite');
            db = new sqlite3.oo1.DB('db.sqlite');
            self.postMessage({ type: 'open', success: true });
            break;
        case 'getTables':
            if (!db) {
                self.postMessage({ type: 'getTables', error: 'Database not open' });
                return;
            }
            const tables = db.exec({
                sql: "SELECT name FROM sqlite_master WHERE type='table'",
                returnValue: "resultRows",
                rowMode: 'array'
            });
            self.postMessage({ type: 'getTables', tables });
            break;
        case 'exec':
            if (!db) {
                self.postMessage({ type: 'exec', error: 'Database not open' });
                return;
            }
            try {
                const result = db.exec({
                    sql: sql,
                    returnValue: "resultRows",
                    rowMode: 'object'
                });

                if (result.length === 0) {
                    self.postMessage({ type: 'exec', results: [], columns: [] });
                    return;
                }

                const columns = Object.keys(result[0]).map(key => ({ Header: key, accessor: key }));
                self.postMessage({ type: 'exec', results: result, columns });
            } catch (err) {
                self.postMessage({ type: 'exec', error: err.message });
            }
            break;
    }
};