import init, { deobfuscate_stack_trace, get_rules, deobfuscate_class } from './proguard-wasm/pkg';

let wasmInitialized = false;

const initializeWasm = async () => {
    if (!wasmInitialized) {
        await init();
        wasmInitialized = true;
    }
};

export const deobfuscateStackTrace = async (mappingFile: string, stackTrace: string): Promise<string> => {
    await initializeWasm();
    return deobfuscate_stack_trace(mappingFile, stackTrace);
};

export const getRules = async (mappingFile: string): Promise<string> => {
    await initializeWasm();
    return get_rules(mappingFile);
};

export const deobfuscateClass = async (mappingFile: string, className: string): Promise<string> => {
    await initializeWasm();
    return deobfuscate_class(mappingFile, className);
};
