import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import AceEditorImport from 'react-ace';
const AceEditor: any = (AceEditorImport as any).default || AceEditorImport;
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/theme-github";
import { extractSymbols } from './symbolExtractor';
import { getFileRenameEntry, saveFileRenameEntry } from './renameStorage';

const replaceIdentifier = (code: string, oldName: string, newName: string): string => {
    if (!oldName || !newName || oldName === newName) return code;
    const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedOld}\\b`, 'g');
    return code.replace(regex, newName);
};

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

    const [functionRenames, setFunctionRenames] = useState<Record<string, string>>({});
    const [variableRenames, setVariableRenames] = useState<Record<string, Record<string, string>>>({});
    const functionRenamesRef = useRef<Record<string, string>>({});
    const variableRenamesRef = useRef<Record<string, Record<string, string>>>({});

    const [renameModal, setRenameModal] = useState<{ type: 'function' | 'variable'; oldName: string; funcName?: string } | null>(null);
    const [modalNewName, setModalNewName] = useState<string>('');
    const [modalOldVar, setModalOldVar] = useState<string>('');

    const worker = useMemo(() => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }), []);
    const fileRef = useRef<File | null>(null);
    const aceEditorRef = useRef<any>(null);

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
                    setStatus(prev => prev.startsWith('Detecting') ? `Ready (${e.data.arch})` : prev);
                }
            } else if (e.data.action === 'decompiled') {
                let code = e.data.code;
                const currentFunc = e.data.funcName;

                // Apply function renames
                for (const [orig, renamed] of Object.entries(functionRenamesRef.current)) {
                    if (orig !== renamed) {
                        code = replaceIdentifier(code, orig, renamed);
                    }
                }

                // Apply variable renames for current function
                const funcVarMap = variableRenamesRef.current[currentFunc] || {};
                for (const [oldVar, newVar] of Object.entries(funcVarMap)) {
                    code = replaceIdentifier(code, oldVar, newVar);
                }

                setDecompiledCode(code);
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

            // Restore renames from localStorage
            const entry = getFileRenameEntry(file.name);
            const initialFuncRenames = entry?.functionRenames || {};
            const initialVarRenames = entry?.variableRenames || {};
            functionRenamesRef.current = initialFuncRenames;
            variableRenamesRef.current = initialVarRenames;
            setFunctionRenames(initialFuncRenames);
            setVariableRenames(initialVarRenames);

            setStatus('Detecting architecture...');
            const buffer = await file.arrayBuffer();
            worker.postMessage({ action: 'detect_architecture', buffer: buffer.slice(0) }, [buffer]);

            setStatus('Extracting symbols and segments...');
            try {
                const binutilsWorkerUrl = new URL('../binutils/worker.js', import.meta.url);
                const combinedSymbols = await extractSymbols(binutilsWorkerUrl, file);
                console.log('[GhidraUI] Total extracted symbols:', combinedSymbols.length);

                const mappedSymbols = combinedSymbols.map((s: any) => {
                    const origName = s.originalName || s.name;
                    const currentName = initialFuncRenames[origName] || s.name;
                    return {
                        ...s,
                        originalName: origName,
                        name: currentName
                    };
                });

                setSymbols(mappedSymbols);
                setStatus(prev => (prev === 'Extracting symbols...' || prev.startsWith('Ready')) ? `Ready (${mappedSymbols.length} symbols)` : prev);
            } catch (err) {
                console.error('[GhidraUI] Failed symbol extraction:', err);
                setStatus('Failed to extract symbols.');
            }

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
                                    extractedSegments.push({
                                        offset: parts[1],
                                        vaddr: parts[2],
                                        filesiz: parts[4]
                                    });
                                } else if (parts.length >= 4) {
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
                optimizedSymbols = symbols.filter(s => {
                    if (s.address === '?' || s.name === funcName) return true;
                    const addr = parseInt(s.address, 16);
                    return addr >= targetAddr - 524288 && addr <= targetAddr + 524288;
                });
                console.log(`[GhidraUI] Pre-filtered symbols for worker: ${optimizedSymbols.length} / ${symbols.length} at 0x${targetAddr.toString(16)}`);
            }

            const buffer = await fileRef.current.arrayBuffer();
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

    const handleConfirmFunctionRename = (oldName: string, newName: string) => {
        if (!newName || oldName === newName) {
            setRenameModal(null);
            return;
        }

        const sym = symbols.find(s => s.name === oldName);
        const origName = sym?.originalName || oldName;

        const updatedFuncRenames = { ...functionRenamesRef.current, [origName]: newName };
        functionRenamesRef.current = updatedFuncRenames;
        setFunctionRenames(updatedFuncRenames);

        if (fileRef.current) {
            saveFileRenameEntry(fileRef.current.name, updatedFuncRenames, variableRenamesRef.current);
        }

        const updatedSymbols = symbols.map(s => {
            if (s.name === oldName || s.originalName === origName) {
                return { ...s, name: newName, originalName: origName };
            }
            return s;
        });
        setSymbols(updatedSymbols);

        if (selectedFunc === oldName) {
            setSelectedFunc(newName);
        }

        setDecompiledCode(prev => replaceIdentifier(prev, oldName, newName));
        setRenameModal(null);
    };

    const handleConfirmVariableRename = (funcName: string, oldVar: string, newVar: string) => {
        if (!funcName || !oldVar || !newVar || oldVar === newVar) {
            setRenameModal(null);
            return;
        }

        const currentMap = variableRenamesRef.current[funcName] || {};
        const updatedVarMap = { ...currentMap, [oldVar]: newVar };
        const updatedAllVarRenames = { ...variableRenamesRef.current, [funcName]: updatedVarMap };

        variableRenamesRef.current = updatedAllVarRenames;
        setVariableRenames(updatedAllVarRenames);

        if (fileRef.current) {
            saveFileRenameEntry(fileRef.current.name, functionRenamesRef.current, updatedAllVarRenames);
        }

        setDecompiledCode(prev => replaceIdentifier(prev, oldVar, newVar));
        setRenameModal(null);
    };

    const openRenameVariableDialog = () => {
        const selectedText = aceEditorRef.current?.getSelectedText()?.trim() || '';
        setModalOldVar(selectedText);
        setModalNewName('');
        setRenameModal({ type: 'variable', oldName: selectedText, funcName: selectedFunc });
    };

    const openRenameFunctionDialog = (symName: string) => {
        setModalNewName(symName);
        setRenameModal({ type: 'function', oldName: symName });
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
                                borderBottom: '1px solid #eee',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <div style={{ fontWeight: 'bold', wordBreak: 'break-all' }}>{s.name}</div>
                                <div style={{ fontSize: '0.8em', color: '#666' }}>{s.address} ({s.type})</div>
                            </div>
                            <button
                                className="rename-func-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openRenameFunctionDialog(s.name);
                                }}
                                style={{ marginLeft: '8px', padding: '3px 8px', fontSize: '0.75em', cursor: 'pointer' }}
                            >
                                Rename
                            </button>
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
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {selectedFunc && (
                            <>
                                <button
                                    className="toolbar-rename-func-btn"
                                    onClick={() => openRenameFunctionDialog(selectedFunc)}
                                    style={{ padding: '4px 10px', cursor: 'pointer' }}
                                >
                                    Rename Function
                                </button>
                                <button
                                    className="toolbar-rename-var-btn"
                                    onClick={openRenameVariableDialog}
                                    style={{ padding: '4px 10px', cursor: 'pointer' }}
                                >
                                    Rename Variable
                                </button>
                            </>
                        )}
                        <div style={{ color: loading ? '#0066cc' : '#666', fontSize: '0.9em' }}>{status}</div>
                    </div>
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
                        onLoad={(editor: any) => { aceEditorRef.current = editor; }}
                        setOptions={{ useWorker: false }}
                    />
                </div>
            </div>

            {renameModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '6px', width: '360px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ marginTop: 0 }}>
                            {renameModal.type === 'function' ? `Rename Function "${renameModal.oldName}"` : `Rename Variable in "${renameModal.funcName}"`}
                        </h3>
                        {renameModal.type === 'variable' && (
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontSize: '0.85em', marginBottom: '4px', color: '#555' }}>Original Variable Name:</label>
                                <input
                                    type="text"
                                    className="rename-old-var-input"
                                    placeholder="Old variable name"
                                    value={modalOldVar}
                                    onChange={(e) => setModalOldVar(e.target.value)}
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                                />
                            </div>
                        )}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '0.85em', marginBottom: '4px', color: '#555' }}>
                                {renameModal.type === 'function' ? 'New Function Name:' : 'New Variable Name:'}
                            </label>
                            <input
                                type="text"
                                className="rename-input"
                                placeholder={renameModal.type === 'function' ? 'New function name' : 'New variable name'}
                                value={modalNewName}
                                onChange={(e) => setModalNewName(e.target.value)}
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                className="cancel-rename-btn"
                                onClick={() => setRenameModal(null)}
                                style={{ padding: '6px 12px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                className="confirm-rename-btn"
                                onClick={() => {
                                    if (renameModal.type === 'function') {
                                        handleConfirmFunctionRename(renameModal.oldName, modalNewName.trim());
                                    } else {
                                        handleConfirmVariableRename(renameModal.funcName || '', modalOldVar.trim(), modalNewName.trim());
                                    }
                                }}
                                style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px' }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<GhidraApp />);
