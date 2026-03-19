import GhidraDecompiler from './ghidra_decompiler.js';

let decompilerModule: any = null;

async function getDecompiler() {
    if (decompilerModule) return decompilerModule;
    decompilerModule = await GhidraDecompiler();
    decompilerModule._init_decompiler();
    return decompilerModule;
}

self.onmessage = async (e: MessageEvent) => {
    const { action, buffer, fileName, funcName, arch, sla, pspec, cspec, baseAddr } = e.data;

    try {
        if (action === 'detect_architecture') {
            const module = await getDecompiler();
            const data = new Uint8Array(buffer);
            const binPtr = module._malloc(data.length);
            module.HEAPU8.set(data, binPtr);
            const detectedId = module.ccall('detect_architecture', 'string', ['number', 'number'], [binPtr, data.length]);
            module._free(binPtr);
            self.postMessage({ action: 'detected_architecture', arch: detectedId });
        } else if (action === 'decompile') {
            const module = await getDecompiler();
            const data = new Uint8Array(buffer);

            const slaData = new Uint8Array(sla);
            const slaPtr = module._malloc(slaData.length);
            module.HEAPU8.set(slaData, slaPtr);

            const bytesToHex = (bytes: Uint8Array) => {
                const hex = [];
                for (let i = 0; i < bytes.length; i++) {
                    hex.push(bytes[i].toString(16).padStart(2, '0'));
                }
                for (let i = 0; i < 32; i++) hex.push('00');
                return hex.join('');
            };

            const imageXml = `
                <binaryimage arch="${arch}">
                <bytechunk space="ram" offset="${baseAddr || '0x0'}">
                ${bytesToHex(data)}
                </bytechunk>
                </binaryimage>`;

            const resultPtr = module.ccall(
                'decompile_pcode',
                'number',
                ['number', 'number', 'string', 'string', 'string', 'string'],
                [slaPtr, slaData.length, pspec, cspec, imageXml, funcName]
            );
            const result = module.UTF8ToString(resultPtr);
            module._free_string(resultPtr);
            module._free(slaPtr);

            self.postMessage({ action: 'decompiled', code: result, funcName });
        }
    } catch (err: any) {
        self.postMessage({ action: 'error', error: err.message });
    }
};
