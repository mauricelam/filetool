export type SqliteInitMessage = {
    type: 'init';
};

export type SqliteOpenMessage = {
    type: 'open';
    file: File;
};

export type SqliteGetTablesMessage = {
    type: 'getTables';
};

export type SqliteExecMessage = {
    type: 'exec';
    sql: string;
};

export type SqliteWorkerMessage = SqliteInitMessage | SqliteOpenMessage | SqliteGetTablesMessage | SqliteExecMessage;

export type SqliteInitResponseMessage = {
    type: 'init';
    success: boolean;
    error?: string;
};

export type SqliteOpenResponseMessage = {
    type: 'open';
    success: boolean;
    error?: string;
};

export type SqliteGetTablesResponseMessage = {
    type: 'getTables';
    tables: string[][];
    error?: string;
};

export type SqliteExecResponseMessage = {
    type: 'exec';
    results: any[];
    columns: any[];
    error?: string;
};

export type SqliteWorkerResponseMessage = SqliteInitResponseMessage | SqliteOpenResponseMessage | SqliteGetTablesResponseMessage | SqliteExecResponseMessage;
