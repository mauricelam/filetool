import init, { deobfuscate } from './proguard-wasm.js';

let wasmInitialized = false;

const initializeWasm = async () => {
    if (!wasmInitialized) {
        await init();
        wasmInitialized = true;
    }
};

export const deobfuscateStackTrace = async (mappingFile: string, stackTrace: string): Promise<string> => {
    await initializeWasm();
    return deobfuscate(mappingFile, stackTrace);
};
