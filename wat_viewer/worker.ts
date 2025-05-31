import wabt from "wabt"

self.onmessage = async (e) => {
    console.log('message', e)
    if (e.data.action === 'fileToWat') {
        const wat = await fileToWat(e.data.file)
        self.postMessage(wat)
    } else {
        throw new Error(`Unknown action ${e.data.action}`)
    }
}

export async function fileToWat(file: File): Promise<string> {
    const wabtool = await wabt()
    const module = wabtool.readWasm(new Uint8Array(await file.arrayBuffer()), ALL_WASM_FEATURES)
    return module.toText({})
}

const ALL_WASM_FEATURES = {
    /** Experimental exception handling. */
    exceptions: true,
    /** Import/export mutable globals. */
    mutable_globals: true,
    /** Saturating float-to-int operators. */
    sat_float_to_int: true,
    /** Sign-extension operators. */
    sign_extension: true,
    /** SIMD support. */
    simd: true,
    /** Threading support. */
    threads: true,
    /** Typed function references. */
    function_references: true,
    /** Multi-value. */
    multi_value: true,
    /** Tail-call support. */
    tail_call: true,
    /** Bulk-memory operations. */
    bulk_memory: true,
    /** Reference types (externref). */
    reference_types: true,
    /** Custom annotation syntax. */
    annotations: true,
    /** Code metadata. */
    code_metadata: true,
    /** Garbage collection. */
    gc: true,
    /** 64-bit memory */
    memory64: true,
    /** Extended constant expressions. */
    extended_const: true,
    /** Relaxed SIMD. */
    relaxed_simd: true,
}
