import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import AceEditor from 'react-ace';
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/theme-github";

const GhidraApp = () => {
    const [file, setFile] = useState<File | null>(null);
    const [arch, setArch] = useState<string>('');
    const [symbols, setSymbols] = useState<any[]>([]);
    const [selectedFunc, setSelectedFunc] = useState<string>('');
    const [decompiledCode, setDecompiledCode] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [processors, setProcessors] = useState<any[]>([]);
    const [status, setStatus] = useState<string>('Initializing...');

    const worker = useMemo(() => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }), []);
    const fileRef = useRef<File | null>(null);

    useEffect(() => {
        fetch('processors.json').then(r => r.json()).then(setProcessors);

        worker.onmessage = (e) => {
            console.log('[GhidraUI] Worker message:', e.data);
            if (e.data.action === 'detected_architecture') {
                setArch(e.data.arch);
                if (e.data.arch === 'unknown') {
                    setStatus('Architecture detection failed. Please select manually.');
                } else {
                    setStatus(`Detected: ${e.data.arch}`);
                }
            } else if (e.data.action === 'decompiled') {
                setDecompiledCode(e.data.code);
                setLoading(false);
                setStatus('Decompilation complete.');
            } else if (e.data.action === 'error') {
                console.error('[GhidraUI] Worker error:', e.data.error);
                setLoading(false);
                setStatus(`Error: ${e.data.error}`);
            }
        };

        const handleFile = async (file: File) => {
            console.log('[GhidraUI] Handling file:', file.name);
            setFile(file);
            fileRef.current = file;
            setStatus('Detecting architecture...');
            const buffer = await file.arrayBuffer();
            worker.postMessage({ action: 'detect_architecture', buffer: buffer.slice(0) }, [buffer]);

            setStatus('Extracting symbols...');
            // Extract symbols using binutils (nm)
            const nmWorker = new Worker(new URL('../binutils/worker.js', import.meta.url), { type: 'module' });
            const nmBuffer = await file.arrayBuffer();
            let nmOutput = '';
            nmWorker.onmessage = (e) => {
                if (typeof e.data === 'string') {
                    nmOutput += e.data + '\n';
                } else if (e.data.action === 'done') {
                    const lines = nmOutput.split('\n');
                    const extractedSymbols = lines.map(line => {
                        // Match common nm output formats:
                        // 0000000000001000 T main
                        // 00001000 t func
                        const match = line.trim().match(/^([0-9a-fA-F]*)\s+([tTwW])\s+(.+)$/);
                        if (match) {
                            return { address: match[1] ? '0x' + match[1] : '?', type: match[2], name: match[3] };
                        }
                        return null;
                    }).filter(s => s !== null);
                    console.log('[GhidraUI] Extracted symbols:', extractedSymbols.length);
                    setSymbols(extractedSymbols);
                    nmWorker.terminate();
                    setStatus(prev => prev === 'Extracting symbols...' ? 'Ready' : prev);
                }
            };
            nmWorker.onerror = (err) => {
                console.error('[GhidraUI] NM Worker Error:', err);
                setStatus('Failed to extract symbols.');
            };
            nmWorker.postMessage({ action: 'nm', buffer: nmBuffer, flags: ['-C'], fileName: file.name }, [nmBuffer]);
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
        setSelectedFunc(funcName);
        setStatus(`Decompiling ${funcName}...`);

        const proc = processors.find(p => p.id === arch);
        if (!proc) {
            console.error('[GhidraUI] Processor not found for arch:', arch);
            setLoading(false);
            setStatus(`Unsupported architecture: ${arch}`);
            return;
        }

        try {
            console.log('[GhidraUI] Fetching specs for:', arch);
            const [sla, pspec, cspec] = await Promise.all([
                fetch(proc.sla).then(r => r.arrayBuffer()),
                fetch(proc.pspec).then(r => r.text()),
                fetch(proc.compilers[0].spec).then(r => r.text()),
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
                baseAddr: '0x0'
            }, [buffer, sla]);
        } catch (err: any) {
            console.error('[GhidraUI] Failed to fetch specs:', err);
            setLoading(false);
            setStatus(`Failed to load processor specs: ${err.message}`);
        }
    };

    const filteredSymbols = symbols.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ width: '300px', borderRight: '1px solid #ccc', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
                    <input
                        type="text"
                        placeholder="Search symbols..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '5px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredSymbols.length === 0 && <div style={{ padding: '10px' }}>{symbols.length > 0 ? 'No matches' : 'No symbols found'}</div>}
                    {filteredSymbols.map(s => (
                        <div
                            key={s.name + s.address}
                            onClick={() => handleDecompile(s.name)}
                            style={{
                                padding: '10px',
                                cursor: 'pointer',
                                backgroundColor: (selectedFunc === s.name || selectedFunc === s.address) ? '#e0e0e0' : 'transparent',
                                borderBottom: '1px solid #eee'
                            }}
                        >
                            <div style={{ fontWeight: 'bold', wordBreak: 'break-all' }}>{s.name}</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>{s.address} ({s.type})</div>
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #ccc', backgroundColor: '#f5f5f5', display: 'flex', justifyContent: 'space-between' }}>
                    <div>Architecture: <b>{arch || 'Detecting...'}</b></div>
                    <div style={{ color: '#666', fontSize: '0.9em' }}>{status}</div>
                </div>
                {(arch === 'unknown' || status.includes('failed')) && (
                    <div style={{ padding: '10px', backgroundColor: '#fffbe6', borderBottom: '1px solid #ffe58f' }}>
                        Manual Selection:
                        <select onChange={(e) => {
                            setArch(e.target.value);
                            setStatus(`Selected: ${e.target.value}`);
                        }} value={arch} style={{ marginLeft: '10px' }}>
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
