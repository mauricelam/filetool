import GhidraDecompiler from './ghidra_decompiler.js';

let decompilerModule: any = null;

const byteToHexMap: Uint8Array = new Uint8Array(256 * 2);
for (let i = 0; i < 256; i++) {
    const s = i.toString(16).padStart(2, '0');
    byteToHexMap[i * 2] = s.charCodeAt(0);
    byteToHexMap[i * 2 + 1] = s.charCodeAt(1);
}

const hexDecoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array) {
    const hex = new Uint8Array(bytes.length * 2);
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        hex[i * 2] = byteToHexMap[b * 2];
        hex[i * 2 + 1] = byteToHexMap[b * 2 + 1];
    }
    return hexDecoder.decode(hex);
}

function escapeXml(unsafe: string) {
    return unsafe.replace(/[<>&"']/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&apos;';
            default: return c;
        }
    });
}

async function getDecompiler() {
    if (decompilerModule) return decompilerModule;
    console.log('[GhidraWorker] Loading Ghidra Decompiler WASM...');
    decompilerModule = await GhidraDecompiler();
    decompilerModule._init_decompiler();
    console.log('[GhidraWorker] Ghidra Decompiler WASM initialized.');
    return decompilerModule;
}

self.onmessage = async (e: MessageEvent) => {
    const { action, buffer, fileName, funcName, targetAddr, arch, sla, pspec, cspec, segments, symbols, baseAddr } = e.data;
    console.log('[GhidraWorker] Message received:', action, { fileName, funcName, targetAddr, arch });

    try {
        if (action === 'detect_architecture') {
            const module = await getDecompiler();
            const data = new Uint8Array(buffer);
            const binPtr = module._malloc(data.length);
            module.HEAPU8.set(data, binPtr);
            const detectedId = module.ccall('detect_architecture', 'string', ['number', 'number'], [binPtr, data.length]);
            module._free(binPtr);
            console.log('[GhidraWorker] Architecture detected:', detectedId);
            self.postMessage({ action: 'detected_architecture', arch: detectedId || 'unknown' });
        } else if (action === 'decompile') {
            const module = await getDecompiler();
            const data = new Uint8Array(buffer);

            const slaData = new Uint8Array(sla);
            const slaPtr = module._malloc(slaData.length);
            module.HEAPU8.set(slaData, slaPtr);

            // Use passed targetAddr for windowing
            const targetVaddr: number | null = (targetAddr && targetAddr !== 0) ? targetAddr : null;
            if (targetVaddr) {
                console.log(`[GhidraWorker] Windowing around 0x${targetVaddr.toString(16)}`);
            }

            const WINDOW_SIZE = 128 * 1024; // 128KB window around function (256KB total)
            const MAX_TOTAL_SIZE = 1024 * 1024; // Limit to 1MB total if no target
            const CHUNK_SIZE = 32 * 1024; // 32KB chunks
            let imageXmlParts = [`<binaryimage arch="${arch}">\n`];
            let chunksIncluded = 0;
            let totalBytes = 0;

            const shouldInclude = (vaddr: number, size: number) => {
                if (targetVaddr === null) {
                    if (totalBytes + size <= MAX_TOTAL_SIZE) {
                        totalBytes += size;
                        return true;
                    }
                    return false;
                }
                // Include if chunk overlaps with [target - WINDOW, target + WINDOW]
                const included = vaddr + size >= targetVaddr - WINDOW_SIZE && vaddr <= targetVaddr + WINDOW_SIZE;
                if (included) totalBytes += size;
                return included;
            };

            if (segments && segments.length > 0) {
                for (const seg of segments) {
                    const baseOffset = parseInt(seg.offset, 16);
                    const baseVaddr = parseInt(seg.vaddr, 16);
                    const filesiz = parseInt(seg.filesiz, 16);

                    for (let i = 0; i < filesiz; i += CHUNK_SIZE) {
                        const currentChunkSize = Math.min(CHUNK_SIZE, filesiz - i);
                        const vaddrVal = baseVaddr + i;
                        if (shouldInclude(vaddrVal, currentChunkSize)) {
                            const chunkData = data.subarray(baseOffset + i, baseOffset + i + currentChunkSize);
                            const vaddrStr = '0x' + vaddrVal.toString(16);
                            imageXmlParts.push(`<bytechunk space="ram" offset="${vaddrStr}">\n${bytesToHex(chunkData)}\n</bytechunk>\n`);
                            chunksIncluded++;
                        }
                    }
                }
            } else {
                const filesiz = data.length;
                const baseVaddr = parseInt(baseAddr || '0x0', 16);
                for (let i = 0; i < filesiz; i += CHUNK_SIZE) {
                    const currentChunkSize = Math.min(CHUNK_SIZE, filesiz - i);
                    const vaddrVal = baseVaddr + i;
                    if (shouldInclude(vaddrVal, currentChunkSize)) {
                        const chunkData = data.subarray(i, i + currentChunkSize);
                        const vaddrStr = '0x' + vaddrVal.toString(16);
                        imageXmlParts.push(`<bytechunk space="ram" offset="${vaddrStr}">\n${bytesToHex(chunkData)}\n</bytechunk>\n`);
                        chunksIncluded++;
                    }
                }
            }
            console.log(`[GhidraWorker] Included ${chunksIncluded} chunks in XML`);

            if (symbols && symbols.length > 0) {
                // Limit to 100 symbols to avoid huge XML and potential crash
                const limit = 100;
                let count = 0;
                const seenAddresses = new Set<string>();

                // Prioritize the target function symbol
                const targetSym = symbols.find(s => s.name === funcName && s.address !== '?');
                if (targetSym) {
                    imageXmlParts.push(`<symbol space="ram" offset="${targetSym.address}" name="${escapeXml(targetSym.name)}"/>\n`);
                    seenAddresses.add(targetSym.address);
                    count++;
                }

                for (const sym of symbols) {
                    if (count >= limit) break;
                    if (sym.address !== '?' && !seenAddresses.has(sym.address)) {
                        const addr = parseInt(sym.address, 16);
                        // Only include symbols within a small window (512KB around target)
                        if (targetVaddr === null || (addr >= targetVaddr - 262144 && addr <= targetVaddr + 262144)) {
                            imageXmlParts.push(`<symbol space="ram" offset="${sym.address}" name="${escapeXml(sym.name)}"/>\n`);
                            seenAddresses.add(sym.address);
                            count++;
                        }
                    }
                }
                console.log(`[GhidraWorker] Included ${count} symbols in XML`);
            }

            imageXmlParts.push(`</binaryimage>`);
            const imageXml = imageXmlParts.join('');
            console.log(`[GhidraWorker] Image XML size: ${imageXml.length} characters`);

            console.log(`[GhidraWorker] Decompiling ${funcName}...`);
            const resultPtr = module.ccall(
                'decompile_pcode',
                'number',
                ['number', 'number', 'string', 'string', 'string', 'string'],
                [slaPtr, slaData.length, pspec, cspec, imageXml, funcName]
            );
            const result = module.UTF8ToString(resultPtr);
            module._free_string(resultPtr);
            module._free(slaPtr);

            console.log(`[GhidraWorker] Decompilation of ${funcName} complete.`);
            self.postMessage({ action: 'decompiled', code: result, funcName });
        }
    } catch (err: any) {
        console.error('[GhidraWorker] Error:', err);
        self.postMessage({ action: 'error', error: err.message || String(err) });
    }
};
