/* tslint:disable */
/* eslint-disable */
export function dex_methods(bytes: Uint8Array, class_id: number): any;
export function dex_classes(bytes: Uint8Array): any;
export function load_proguard_mapping(mapping: string): void;
export function dex_fields(bytes: Uint8Array, class_id: number): any;
export function dex_instructions(bytes: Uint8Array, method: any): any;
export function init_logger(): void;
export class JClass {
  private constructor();
  free(): void;
  name: string;
  original_name: string;
  descriptor: string;
  /**
   * The class ID that the Go side uses, which is the index of the class in the iterator.
   * Note: This is not the same as class.id()
   */
  id: number;
  /**
   * Space-separated access flags like "public final".
   */
  access_flags: string;
  /**
   * Java type name of the superclass, if present.
   */
  get super_name(): string | undefined;
  /**
   * Java type name of the superclass, if present.
   */
  set super_name(value: string | null | undefined);
  /**
   * Java type names of implemented interfaces.
   */
  interfaces: string[];
  /**
   * Annotation type names present on the class (e.g., "Lcom/example/Anno;" -> "com.example.Anno").
   */
  annotations: string[];
  /**
   * Method names of this class.
   */
  method_names: string[];
}
export class JField {
  private constructor();
  free(): void;
  name: string;
  type_name: string;
  access_flags: string;
  is_static: boolean;
  class_descriptor: string;
  class_id: number;
}
export class JInstruction {
  private constructor();
  free(): void;
  name: string;
  opname: string;
}
export class JMethod {
  private constructor();
  free(): void;
  name: string;
  class_descriptor: string;
  class_id: number;
  parameters: string[];
  return_type: string;
  access_flags: string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_get_jclass_access_flags: (a: number) => [number, number];
  readonly __wbg_get_jclass_annotations: (a: number) => [number, number];
  readonly __wbg_get_jclass_descriptor: (a: number) => [number, number];
  readonly __wbg_get_jclass_id: (a: number) => number;
  readonly __wbg_get_jclass_interfaces: (a: number) => [number, number];
  readonly __wbg_get_jclass_method_names: (a: number) => [number, number];
  readonly __wbg_get_jclass_name: (a: number) => [number, number];
  readonly __wbg_get_jclass_original_name: (a: number) => [number, number];
  readonly __wbg_get_jclass_super_name: (a: number) => [number, number];
  readonly __wbg_get_jfield_class_id: (a: number) => number;
  readonly __wbg_get_jfield_is_static: (a: number) => number;
  readonly __wbg_get_jmethod_access_flags: (a: number) => [number, number];
  readonly __wbg_get_jmethod_class_id: (a: number) => number;
  readonly __wbg_get_jmethod_parameters: (a: number) => [number, number];
  readonly __wbg_jclass_free: (a: number, b: number) => void;
  readonly __wbg_jfield_free: (a: number, b: number) => void;
  readonly __wbg_jinstruction_free: (a: number, b: number) => void;
  readonly __wbg_jmethod_free: (a: number, b: number) => void;
  readonly __wbg_set_jclass_access_flags: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jclass_annotations: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jclass_descriptor: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jclass_id: (a: number, b: number) => void;
  readonly __wbg_set_jclass_interfaces: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jclass_method_names: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jclass_name: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jclass_original_name: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jclass_super_name: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jfield_class_id: (a: number, b: number) => void;
  readonly __wbg_set_jfield_is_static: (a: number, b: number) => void;
  readonly __wbg_set_jmethod_access_flags: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jmethod_class_id: (a: number, b: number) => void;
  readonly __wbg_set_jmethod_parameters: (a: number, b: number, c: number) => void;
  readonly dex_classes: (a: number, b: number) => [number, number, number];
  readonly dex_fields: (a: number, b: number, c: number) => [number, number, number];
  readonly dex_instructions: (a: number, b: number, c: any) => [number, number, number];
  readonly dex_methods: (a: number, b: number, c: number) => [number, number, number];
  readonly init_logger: () => void;
  readonly load_proguard_mapping: (a: number, b: number) => void;
  readonly __wbg_get_jfield_access_flags: (a: number) => [number, number];
  readonly __wbg_get_jfield_class_descriptor: (a: number) => [number, number];
  readonly __wbg_get_jfield_name: (a: number) => [number, number];
  readonly __wbg_get_jfield_type_name: (a: number) => [number, number];
  readonly __wbg_get_jinstruction_name: (a: number) => [number, number];
  readonly __wbg_get_jinstruction_opname: (a: number) => [number, number];
  readonly __wbg_get_jmethod_class_descriptor: (a: number) => [number, number];
  readonly __wbg_get_jmethod_name: (a: number) => [number, number];
  readonly __wbg_get_jmethod_return_type: (a: number) => [number, number];
  readonly __wbg_set_jfield_access_flags: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jfield_class_descriptor: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jfield_name: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jfield_type_name: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jinstruction_name: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jinstruction_opname: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jmethod_class_descriptor: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jmethod_name: (a: number, b: number, c: number) => void;
  readonly __wbg_set_jmethod_return_type: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
