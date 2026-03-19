import React, { useEffect, useState, useMemo } from 'react';
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

    const worker = useMemo(() => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }), []);

    useEffect(() => {
        fetch('processors.json').then(r => r.json()).then(setProcessors);

        worker.onmessage = (e) => {
            if (e.data.action === 'detected_architecture') {
                setArch(e.data.arch);
            } else if (e.data.action === 'decompiled') {
                setDecompiledCode(e.data.code);
                setLoading(false);
            } else if (e.data.action === 'error') {
                console.error(e.data.error);
                setLoading(false);
            }
        };

        const handleFile = async (file: File) => {
            setFile(file);
            const buffer = await file.arrayBuffer();
            worker.postMessage({ action: 'detect_architecture', buffer: buffer.slice(0) }, [buffer]);

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
                        const match = line.match(/^([0-9a-fA-F]+)\s+([tTwW])\s+(.+)$/);
                        if (match) {
                            return { address: '0x' + match[1], type: match[2], name: match[3] };
                        }
                        return null;
                    }).filter(s => s !== null);
                    setSymbols(extractedSymbols);
                    nmWorker.terminate();
                }
            };
            nmWorker.onerror = (err) => console.error('NM Worker Error:', err);
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
        if (!file || !arch) return;
        setLoading(true);
        setSelectedFunc(funcName);

        const proc = processors.find(p => p.id === arch);
        if (!proc) {
            console.error('Processor not found for arch:', arch);
            setLoading(false);
            return;
        }

        const [sla, pspec, cspec] = await Promise.all([
            fetch(`processors/${proc.sla}`).then(r => r.arrayBuffer()),
            fetch(`processors/${proc.pspec}`).then(r => r.text()),
            fetch(`processors/${proc.compilers[0].spec}`).then(r => r.text()),
        ]);

        const buffer = await file.arrayBuffer();
        worker.postMessage({
            action: 'decompile',
            buffer,
            fileName: file.name,
            funcName,
            arch,
            sla,
            pspec,
            cspec,
            baseAddr: '0x0'
        }, [buffer, sla]);
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
                    {filteredSymbols.length === 0 && <div style={{ padding: '10px' }}>No symbols found or loading...</div>}
                    {filteredSymbols.map(s => (
                        <div
                            key={s.name + s.address}
                            onClick={() => handleDecompile(s.name)}
                            style={{
                                padding: '10px',
                                cursor: 'pointer',
                                backgroundColor: selectedFunc === s.name ? '#e0e0e0' : 'transparent',
                                borderBottom: '1px solid #eee'
                            }}
                        >
                            <div style={{ fontWeight: 'bold' }}>{s.name}</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>{s.address} ({s.type})</div>
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #ccc', backgroundColor: '#f5f5f5' }}>
                    Architecture: {arch || 'Detecting...'} {loading && <span> (Decompiling {selectedFunc}...)</span>}
                </div>
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
