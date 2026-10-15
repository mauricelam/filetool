import wabt from "wabt"
import { safeReadFile } from "@filetool/common"

self.onmessage = async (e) => {
    console.log('message', e)
    if (e.data.action === 'fileToWat') {
        const wat = await fileToWat(e.data.file)
        self.postMessage(wat)
    } else {
        throw new Error(`Unknown action ${e.data.action}`)
    }
}

async function fileToWat(file: File): Promise<string> {
    const wabtool = await wabt()
    const { buffer } = await safeReadFile(file)
    const module = wabtool.readWasm(buffer, ALL_WASM_FEATURES)
    return module.toText({})
}

const ALL_WASM_FEATURES = {
    exceptions: true,
    mutable_globals: true,
    sat_float_to_int: true,
    sign_extension: true,
    simd: true,
    threads: true,
    function_references: true,
    multi_value: true,
    tail_call: true,
    bulk_memory: true,
    reference_types: true,
    annotations: true,
    code_metadata: true,
    gc: true,
    memory64: true,
    extended_const: true,
    relaxed_simd: true,
}
