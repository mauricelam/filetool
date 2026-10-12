import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import AceEditor from 'react-ace';
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/theme-github";
import initDecompressor, { decode } from '@filetool/decompressor-wasm';

function extractGnuDebugdata(arrayBuffer: ArrayBuffer): ArrayBuffer | null {
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

const GhidraApp = () => {
    const [file, setFile] = useState<File | null>(null);
    const [arch, setArch] = useState<string>('');
    const [symbols, setSymbols] = useState<any[]>([]);
    const [segments, setSegments] = useState<any[]>([]);
    const [selectedFunc, setSelectedFunc] = useState<string>('');
    const [decompiledCode, setDecompiledCode] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [processors, setProcessors] = useState<any[]>([]);
    const [status, setStatus] = useState<string>('Initializing...');
    const [error, setError] = useState<string | null>(null);

    const worker = useMemo(() => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }), []);
    const fileRef = useRef<File | null>(null);

    useEffect(() => {
        fetch('processors.json').then(r => r.json()).then(setProcessors).catch(e => {
            console.error('[GhidraUI] Failed to load processors.json:', e);
            setError('Failed to load architecture list.');
        });

        worker.onmessage = (e) => {
            console.log('[GhidraUI] Worker message:', e.data);
            if (e.data.action === 'detected_architecture') {
                setArch(e.data.arch);
                if (e.data.arch === 'unknown') {
                    setStatus('Architecture detection failed. Please select manually.');
                } else {
                    setStatus(`Detected: ${e.data.arch}`);
                    // If we were waiting for detection to complete for "Ready" status
                    setStatus(prev => prev.startsWith('Detecting') ? `Ready (${e.data.arch})` : prev);
                }
            } else if (e.data.action === 'decompiled') {
                setDecompiledCode(e.data.code);
                setLoading(false);
                setStatus('Decompilation complete.');
            } else if (e.data.action === 'error') {
                console.error('[GhidraUI] Worker error:', e.data.error);
                setLoading(false);
                setError(`Worker Error: ${e.data.error}`);
                setStatus('Error occurred.');
            }
        };

        const handleFile = async (file: File) => {
            console.log('[GhidraUI] Handling file:', file.name);
            setFile(file);
            fileRef.current = file;
            setError(null);
            setStatus('Detecting architecture...');
            const buffer = await file.arrayBuffer();
            worker.postMessage({ action: 'detect_architecture', buffer: buffer.slice(0) }, [buffer]);

            setStatus('Extracting symbols and segments...');
            // Extract symbols using binutils (nm)
            try {
                const binutilsWorkerUrl = new URL('../binutils/worker.js', import.meta.url);
                const runNmOnBuffer = (buf: ArrayBuffer, name: string): Promise<any[]> => {
                    return new Promise((resolve) => {
                        const nmWorker = new Worker(binutilsWorkerUrl, { type: 'module' });
                        let nmOutput = '';
                        nmWorker.onmessage = (ev) => {
                            if (typeof ev.data === 'string') {
                                nmOutput += ev.data + '\n';
                            } else if (ev.data.action === 'done') {
                                const lines = nmOutput.split('\n');
                                const extracted = lines.map(line => {
                                    const match = line.trim().match(/^([0-9a-fA-F]*)\s+([tTwW])\s+(.+)$/);
                                    if (match) {
                                        return { address: match[1] ? '0x' + match[1] : '?', type: match[2], name: match[3] };
                                    }
                                    return null;
                                }).filter(s => s !== null);
                                nmWorker.terminate();
                                resolve(extracted);
                            }
                        };
                        nmWorker.onerror = (err) => {
                            console.error('[GhidraUI] NM Worker Error:', err);
                            nmWorker.terminate();
                            resolve([]);
                        };
                        const copy = buf.slice(0);
                        nmWorker.postMessage({ action: 'nm', buffer: copy, flags: ['-C'], fileName: name }, [copy]);
                    });
                };

                const mainBuffer = await file.arrayBuffer();
                const mainSymbols = await runNmOnBuffer(mainBuffer, file.name);

                let extraSymbols: any[] = [];
                const gnuDebugdataCompressed = extractGnuDebugdata(mainBuffer);
                if (gnuDebugdataCompressed) {
                    console.log('[GhidraUI] Found .gnu_debugdata section, decompressing...');
                    try {
                        await initDecompressor('decompressor_wasm_bg.wasm');
                        const decompressedRes = decode(new Uint8Array(gnuDebugdataCompressed));
                        const decompressedU8 = decompressedRes.data;
                        const decompressedCopy = new Uint8Array(decompressedU8.length);
                        decompressedCopy.set(decompressedU8);
                        extraSymbols = await runNmOnBuffer(decompressedCopy.buffer, 'debugdata.elf');
                        console.log('[GhidraUI] Extracted symbols from .gnu_debugdata:', extraSymbols.length);
                    } catch (decErr) {
                        console.error('[GhidraUI] Failed to decompress .gnu_debugdata:', decErr);
                    }
                }

                const symbolMap = new Map<string, any>();
                for (const sym of [...mainSymbols, ...extraSymbols]) {
                    const key = `${sym.name}@${sym.address}`;
                    if (!symbolMap.has(key)) {
                        symbolMap.set(key, sym);
                    }
                }
                const combinedSymbols = Array.from(symbolMap.values());
                console.log('[GhidraUI] Total extracted symbols:', combinedSymbols.length);
                setSymbols(combinedSymbols);
                setStatus(prev => (prev === 'Extracting symbols...' || prev.startsWith('Ready')) ? `Ready (${combinedSymbols.length} symbols)` : prev);
            } catch (err) {
                console.error('[GhidraUI] Failed to start NM worker:', err);
                setStatus('Failed to start symbol extraction.');
            }

            // Extract segments using readelf
            try {
                const binutilsWorkerUrl = new URL('../binutils/worker.js', import.meta.url);
                const readelfWorker = new Worker(binutilsWorkerUrl, { type: 'module' });
                const readelfBuffer = await file.arrayBuffer();
                let readelfOutput = '';
                readelfWorker.onmessage = (ev) => {
                    if (typeof ev.data === 'string') {
                        readelfOutput += ev.data + '\n';
                    } else if (ev.data.action === 'done') {
                        const extractedSegments: any[] = [];
                        const lines = readelfOutput.split('\n');
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (line.startsWith('LOAD')) {
                                const parts = line.split(/\s+/);
                                if (parts.length >= 5) {
                                    // Format: LOAD offset vaddr paddr filesiz memsiz flags align
                                    extractedSegments.push({
                                        offset: parts[1],
                                        vaddr: parts[2],
                                        filesiz: parts[4]
                                    });
                                } else if (parts.length >= 4) {
                                    // Format: LOAD offset vaddr paddr
                                    // Next line: filesiz memsiz flags align
                                    const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
                                    const nextParts = nextLine.split(/\s+/);
                                    if (nextParts.length >= 2) {
                                        extractedSegments.push({
                                            offset: parts[1],
                                            vaddr: parts[2],
                                            filesiz: nextParts[0]
                                        });
                                    }
                                }
                            }
                        }
                        console.log('[GhidraUI] Extracted segments:', extractedSegments);
                        setSegments(extractedSegments);
                        readelfWorker.terminate();
                    }
                };
                readelfWorker.postMessage({ action: 'readelf', buffer: readelfBuffer, flags: ['-l'], fileName: file.name }, [readelfBuffer]);
            } catch (err) {
                console.error('[GhidraUI] Failed to start Readelf worker:', err);
            }
        };

        window.onmessage = (e) => {
            if (e.data.action === 'respondFile') {
                handleFile(e.data.file);
            }
        };

        if (window.parent) {
            window.parent.postMessage({ 'action': 'requestFile' });
        }
    }, [worker]);

    const handleDecompile = async (funcName: string) => {
        if (!fileRef.current || !arch || arch === 'unknown') return;
        setLoading(true);
        setError(null);
        setSelectedFunc(funcName);
        setStatus(`Decompiling ${funcName}...`);

        const proc = processors.find(p => p.id === arch);
        if (!proc) {
            console.error('[GhidraUI] Processor not found for arch:', arch);
            setLoading(false);
            setError(`Unsupported architecture: ${arch}`);
            return;
        }

        try {
            console.log('[GhidraUI] Fetching specs for:', arch);
            const [sla, pspec, cspec] = await Promise.all([
                fetch(proc.sla).then(r => { if (!r.ok) throw new Error(`Failed to fetch ${proc.sla}`); return r.arrayBuffer(); }),
                fetch(proc.pspec).then(r => { if (!r.ok) throw new Error(`Failed to fetch ${proc.pspec}`); return r.text(); }),
                fetch(proc.compilers[0].spec).then(r => { if (!r.ok) throw new Error(`Failed to fetch ${proc.compilers[0].spec}`); return r.text(); }),
            ]);

            const targetSym = symbols.find(s => s.name === funcName && s.address !== '?');
            let optimizedSymbols = symbols;
            let targetAddr = 0;
            if (targetSym) {
                targetAddr = parseInt(targetSym.address, 16);
                // Pre-filter symbols to only pass those within a 1MB range to the worker
                // This reduces the message payload size significantly.
                optimizedSymbols = symbols.filter(s => {
                    if (s.address === '?' || s.name === funcName) return true;
                    const addr = parseInt(s.address, 16);
                    return addr >= targetAddr - 524288 && addr <= targetAddr + 524288;
                });
                console.log(`[GhidraUI] Pre-filtered symbols for worker: ${optimizedSymbols.length} / ${symbols.length} at 0x${targetAddr.toString(16)}`);
            }

            const buffer = await fileRef.current.arrayBuffer();
            // DO NOT use transferables here because we want to reuse 'buffer'
            // for subsequent decompilations of other functions.
            worker.postMessage({
                action: 'decompile',
                buffer,
                fileName: fileRef.current.name,
                funcName,
                targetAddr,
                arch,
                sla,
                pspec,
                cspec,
                segments,
                symbols: optimizedSymbols,
                baseAddr: '0x0'
            });
        } catch (err: any) {
            console.error('[GhidraUI] Failed to fetch specs:', err);
            setLoading(false);
            setError(`Failed to load processor specs: ${err.message}`);
        }
    };

    const filteredSymbols = useMemo(() => symbols.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())), [symbols, searchTerm]);
    const displayedSymbols = useMemo(() => filteredSymbols.slice(0, 500), [filteredSymbols]);

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ width: '350px', borderRight: '1px solid #ccc', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
                    <input
                        type="text"
                        placeholder="Search symbols..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredSymbols.length === 0 && <div style={{ padding: '10px' }}>{symbols.length > 0 ? 'No matches' : 'No symbols found'}</div>}
                    {displayedSymbols.map(s => (
                        <div
                            key={s.name + s.address}
                            className="symbol-item"
                            onClick={() => handleDecompile(s.name)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                backgroundColor: (selectedFunc === s.name || selectedFunc === s.address) ? '#e0e0e0' : 'transparent',
                                borderBottom: '1px solid #eee'
                            }}
                        >
                            <div style={{ fontWeight: 'bold', wordBreak: 'break-all' }}>{s.name}</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>{s.address} ({s.type})</div>
                        </div>
                    ))}
                    {filteredSymbols.length > 500 && (
                        <div style={{ padding: '10px', fontSize: '0.8em', color: '#666', textAlign: 'center', borderTop: '1px solid #eee' }}>
                            Showing top 500 of {filteredSymbols.length} matches. Use search to find others.
                        </div>
                    )}
                </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #ccc', backgroundColor: '#f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>Architecture: <b>{arch || 'Detecting...'}</b></div>
                    <div style={{ color: loading ? '#0066cc' : '#666', fontSize: '0.9em' }}>{status}</div>
                </div>
                {error && (
                    <div style={{ padding: '10px', backgroundColor: '#fff2f0', borderBottom: '1px solid #ffccc7', color: '#ff4d4f' }}>
                        {error}
                    </div>
                )}
                {(arch === 'unknown' || arch === '') && (
                    <div style={{ padding: '10px', backgroundColor: '#fffbe6', borderBottom: '1px solid #ffe58f' }}>
                        Manual Selection:
                        <select onChange={(e) => {
                            setArch(e.target.value);
                            setStatus(`Selected: ${e.target.value}`);
                        }} value={arch} style={{ marginLeft: '10px', padding: '4px' }}>
                            <option value="unknown">-- Select --</option>
                            {processors.map(p => <option key={p.id} value={p.id}>{p.description}</option>)}
                        </select>
                    </div>
                )}
                <div style={{ flex: 1 }}>
                    <AceEditor
                        mode="c_cpp"
                        theme="github"
                        value={decompiledCode}
                        readOnly={true}
                        width="100%"
                        height="100%"
                        name="decompiler-editor"
                        setOptions={{ useWorker: false }}
                    />
                </div>
            </div>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<GhidraApp />);
