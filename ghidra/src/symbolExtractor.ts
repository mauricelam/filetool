import initDecompressor, { decode } from '@filetool/decompressor-wasm';

export interface SymbolInfo {
    address: string;
    type: string;
    name: string;
}

/**
 * Parses an ELF binary buffer and extracts the raw compressed payload from the
 * `.gnu_debugdata` section if present.
 *
 * GNU MiniDebugInfo compresses a minimal ELF image containing full symbol table
 * metadata into the `.gnu_debugdata` section using XZ compression.
 *
 * @param arrayBuffer - The ArrayBuffer of the ELF binary.
 * @returns The compressed ArrayBuffer of `.gnu_debugdata` section if found, otherwise null.
 */
export function extractGnuDebugdata(arrayBuffer: ArrayBuffer): ArrayBuffer | null {
    const u8 = new Uint8Array(arrayBuffer);
    if (u8.length < 64) return null;
    if (u8[0] !== 0x7f || u8[1] !== 0x45 || u8[2] !== 0x4c || u8[3] !== 0x46) return null;

    const is64 = u8[4] === 2;
    const isLE = u8[5] === 1;
    const view = new DataView(arrayBuffer);

    const get16 = (off: number) => view.getUint16(off, isLE);
    const get32 = (off: number) => view.getUint32(off, isLE);
    const get64 = (off: number) => {
        const lo = view.getUint32(off + (isLE ? 0 : 4), isLE);
        const hi = view.getUint32(off + (isLE ? 4 : 0), isLE);
        return hi * 0x100000000 + lo;
    };

    const e_shoff = is64 ? get64(0x28) : get32(0x20);
    const e_shentsize = is64 ? get16(0x3a) : get16(0x2e);
    const e_shnum = is64 ? get16(0x3c) : get16(0x30);
    const e_shstrndx = is64 ? get16(0x3e) : get16(0x32);

    if (!e_shoff || !e_shnum || e_shstrndx >= e_shnum) return null;

    const shstr_hdr_off = e_shoff + e_shstrndx * e_shentsize;
    const shstr_offset = is64 ? get64(shstr_hdr_off + 24) : get32(shstr_hdr_off + 16);

    for (let i = 0; i < e_shnum; i++) {
        const hdr_off = e_shoff + i * e_shentsize;
        const sh_name = get32(hdr_off);
        const nameOff = shstr_offset + sh_name;
        let nameEnd = nameOff;
        while (nameEnd < u8.length && u8[nameEnd] !== 0) nameEnd++;
        const name = new TextDecoder().decode(u8.subarray(nameOff, nameEnd));
        if (name === '.gnu_debugdata') {
            const sh_offset = is64 ? get64(hdr_off + 24) : get32(hdr_off + 16);
            const sh_size = is64 ? get64(hdr_off + 32) : get32(hdr_off + 20);
            return arrayBuffer.slice(sh_offset, sh_offset + sh_size);
        }
    }
    return null;
}

/**
 * Runs the GNU Binutils `nm` WebAssembly worker on a given binary ArrayBuffer.
 *
 * @param binutilsWorkerUrl - URL of the binutils worker script.
 * @param buf - The ArrayBuffer of the target binary or sub-ELF image.
 * @param fileName - File name label for binutils.
 * @returns Promise resolving to an array of parsed symbol objects.
 */
export function runNmOnBuffer(binutilsWorkerUrl: URL, buf: ArrayBuffer, fileName: string): Promise<SymbolInfo[]> {
    return new Promise((resolve) => {
        const nmWorker = new Worker(binutilsWorkerUrl, { type: 'module' });
        let nmOutput = '';
        nmWorker.onmessage = (ev) => {
            if (typeof ev.data === 'string') {
                nmOutput += ev.data + '\n';
            } else if (ev.data.action === 'done') {
                const lines = nmOutput.split('\n');
                const extracted: SymbolInfo[] = lines.map(line => {
                    const match = line.trim().match(/^([0-9a-fA-F]*)\s+([tTwW])\s+(.+)$/);
                    if (match) {
                        return { address: match[1] ? '0x' + match[1] : '?', type: match[2], name: match[3] };
                    }
                    return null;
                }).filter((s): s is SymbolInfo => s !== null);
                nmWorker.terminate();
                resolve(extracted);
            }
        };
        nmWorker.onerror = (err) => {
            console.error('[GhidraSymbolExtractor] NM Worker Error:', err);
            nmWorker.terminate();
            resolve([]);
        };
        const copy = buf.slice(0);
        nmWorker.postMessage({ action: 'nm', buffer: copy, flags: ['-C'], fileName }, [copy]);
    });
}

/**
 * Extracts all available function symbols from an ELF file.
 *
 * First extracts symbols from the main binary using binutils `nm`.
 * If the binary contains a `.gnu_debugdata` section, decompresses the embedded
 * XZ payload using `@filetool/decompressor-wasm` and extracts additional symbols
 * from the embedded debug ELF, deduplicating symbols by address and name.
 *
 * @param binutilsWorkerUrl - URL to the binutils WASM worker.
 * @param file - The input File object.
 * @returns Promise resolving to a list of extracted symbols.
 */
export async function extractSymbols(binutilsWorkerUrl: URL, file: File): Promise<SymbolInfo[]> {
    const mainBuffer = await file.arrayBuffer();
    const mainSymbols = await runNmOnBuffer(binutilsWorkerUrl, mainBuffer, file.name);

    let extraSymbols: SymbolInfo[] = [];
    const gnuDebugdataCompressed = extractGnuDebugdata(mainBuffer);
    if (gnuDebugdataCompressed) {
        console.log('[GhidraSymbolExtractor] Found .gnu_debugdata section, decompressing...');
        try {
            await initDecompressor('decompressor_wasm_bg.wasm');
            const decompressedRes = decode(new Uint8Array(gnuDebugdataCompressed));
            const decompressedU8 = decompressedRes.data;
            const decompressedCopy = new Uint8Array(decompressedU8.length);
            decompressedCopy.set(decompressedU8);
            extraSymbols = await runNmOnBuffer(binutilsWorkerUrl, decompressedCopy.buffer, 'debugdata.elf');
            console.log('[GhidraSymbolExtractor] Extracted symbols from .gnu_debugdata:', extraSymbols.length);
        } catch (decErr) {
            console.error('[GhidraSymbolExtractor] Failed to decompress .gnu_debugdata:', decErr);
        }
    }

    const symbolMap = new Map<string, SymbolInfo>();
    for (const sym of [...mainSymbols, ...extraSymbols]) {
        const key = `${sym.name}@${sym.address}`;
        if (!symbolMap.has(key)) {
            symbolMap.set(key, sym);
        }
    }
    return Array.from(symbolMap.values());
}
