// proguardviewer/__mocks__/proguard.ts

export const deobfuscateStackTrace = async (mappingFile: string, stackTrace: string): Promise<string> => {
    return Promise.resolve("deobfuscated stack trace");
};

export const getRules = async (mappingFile: string): Promise<string> => {
    return Promise.resolve("rules");
};

export const deobfuscateClass = async (mappingFile: string, className: string): Promise<string> => {
    return Promise.resolve("deobfuscated class");
};
