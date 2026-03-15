/* tslint:disable */
/* eslint-disable */
export interface Ext4File {
    _size: number;
    _mode: number;
    _uid: number;
    _gid: number;
    _path: string;
}

export type Ext4Node = Record<string, Ext4Node> | Ext4File;


/**
 * Parses an ext4 image from a byte vector and returns the hierarchical directory structure.
 *
 * # Arguments
 * * `data` - A byte vector containing the raw ext4 image data.
 *
 * # Returns
 * A result containing the root `Ext4Node` of the filesystem, or an error if parsing fails.
 */
export function parse_ext4(data: Uint8Array): Ext4Node;

/**
 * Reads the content of a specific file from an ext4 image.
 *
 * # Arguments
 * * `data` - A byte vector containing the raw ext4 image data.
 * * `path` - The absolute path of the file to read within the ext4 image.
 *
 * # Returns
 * A result containing the file's content as a byte vector, or an error if reading fails.
 */
export function read_ext4_file(data: Uint8Array, path: string): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly parse_ext4: (a: number, b: number) => [number, number, number];
    readonly read_ext4_file: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
