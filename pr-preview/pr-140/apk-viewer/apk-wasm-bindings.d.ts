/* tslint:disable */
/* eslint-disable */
export interface ArscResource {
    package_id: number;
    type_name: string;
    entry_id: number;
    name: string;
    value: string;
    entries: Record<string, string> | null;
}

export interface ManifestInfo {
    package: string;
    version_code: string | null;
    version_name: string | null;
    min_sdk_version: string | null;
    target_sdk_version: string | null;
}

export interface ApkMetadata {
    manifest: ManifestInfo | null;
    v1_signature: boolean;
    v2_signature: boolean;
    v3_signature: boolean;
    signers: SignerInfo[];
    jar_signatures: string[];
    file_count: number;
    uncompressed_size: number;
}

export interface ApkResponse {
    files: [string, number[]][];
    metadata: ApkMetadata;
}

export interface SignerInfo {
    sha256_digest: string;
    sha1_digest: string;
    md5_digest: string;
    subject: string;
}


export function decode_apk(bytes: Uint8Array): ApkResponse;

export function decode_xml(bytes: Uint8Array): string;

export function extract_arsc(bytes: Uint8Array): ArscResource[];

export function start(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly decode_apk: (a: number, b: number) => [number, number, number];
  readonly decode_xml: (a: number, b: number) => [number, number, number, number];
  readonly extract_arsc: (a: number, b: number) => [number, number, number, number];
  readonly start: () => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __externref_drop_slice: (a: number, b: number) => void;
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
