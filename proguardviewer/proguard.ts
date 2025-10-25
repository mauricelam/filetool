import init, { deobfuscate, get_rules, deobfuscate_class, deobfuscate_method } from './proguard-wasm.js';

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

export const getRules = async (mappingFile: string): Promise<string> => {
    await initializeWasm();
    return get_rules(mappingFile);
};

export const deobfuscateClass = async (mappingFile: string, className: string): Promise<string> => {
    await initializeWasm();
    return deobfuscate_class(mappingFile, className);
};

export const deobfuscateMethod = async (mappingFile: string, className: string, methodName: string): Promise<string> => {
    await initializeWasm();
    return deobfuscate_method(mappingFile, className, methodName);
};
