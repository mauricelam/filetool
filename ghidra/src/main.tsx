import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import AceEditor from 'react-ace';
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/theme-github";

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
                // In production and in Playwright, we are served under /filetool/
                // Use absolute path for worker to be safe
                // The URL for the worker should be relative to the base URL
                const nmWorker = new Worker(new URL('/filetool/binutils/worker.js', window.location.origin), { type: 'module' });
                const nmBuffer = await file.arrayBuffer();
                let nmOutput = '';
                nmWorker.onmessage = (ev) => {
                    if (typeof ev.data === 'string') {
                        nmOutput += ev.data + '\n';
                    } else if (ev.data.action === 'done') {
                        const lines = nmOutput.split('\n');
                        const extractedSymbols = lines.map(line => {
                            const match = line.trim().match(/^([0-9a-fA-F]*)\s+([tTwW])\s+(.+)$/);
                            if (match) {
                                return { address: match[1] ? '0x' + match[1] : '?', type: match[2], name: match[3] };
                            }
                            return null;
                        }).filter(s => s !== null);
                        console.log('[GhidraUI] Extracted symbols:', extractedSymbols.length);
                        setSymbols(extractedSymbols);
                        nmWorker.terminate();
                        setStatus(prev => (prev === 'Extracting symbols...' || prev.startsWith('Ready')) ? `Ready (${extractedSymbols.length} symbols)` : prev);
                    }
                };
                nmWorker.onerror = (err) => {
                    console.error('[GhidraUI] NM Worker Error:', err);
                    setStatus('Failed to extract symbols.');
                };
                nmWorker.postMessage({ action: 'nm', buffer: nmBuffer, flags: ['-C'], fileName: file.name }, [nmBuffer]);
            } catch (err) {
                console.error('[GhidraUI] Failed to start NM worker:', err);
                setStatus('Failed to start symbol extraction.');
            }

            // Extract segments using readelf
            try {
                const readelfWorker = new Worker(new URL('/filetool/binutils/worker.js', window.location.origin), { type: 'module' });
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

            const buffer = await fileRef.current.arrayBuffer();
            worker.postMessage({
                action: 'decompile',
                buffer,
                fileName: fileRef.current.name,
                funcName,
                arch,
                sla,
                pspec,
                cspec,
                segments,
                symbols,
                baseAddr: '0x0'
            }, [buffer, sla]);
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
