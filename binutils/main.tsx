import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

import AceEditor from "react-ace"
import "ace-builds/src-noconflict/ace"
import "ace-builds/src-noconflict/theme-twilight"
import "ace-builds/src-noconflict/mode-lisp"
import "ace-builds/src-noconflict/ext-searchbox"

import './styles.css';
import { Sidebar } from './Sidebar';
import { Controls } from './Controls';
import { FileChunkReader, formatBytes } from 'filetool-common/largeFile';

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const ROOT = createRoot(document.getElementById('root')!)

async function handleFile(file: File) {
    ROOT.render(<App file={file} />)
}

let currentWorker: Worker | null = null;

const TOOLS = [
    {
        name: 'objdump',
        flags: [
            { flag: '-f', label: 'File header' },
            { flag: '-h', label: 'Section Headers' },
            { flag: '-d', label: 'Disassemble' },
            { flag: '-D', label: 'Disassemble All' },
            { flag: '-S', label: 'Source Code' },
        ],
        defaultFlags: ['-f', '-h'],
    },
    {
        name: 'nm',
        flags: [
            { flag: '-D', label: 'Exported symbols' },
            { flag: '-a', label: 'All Symbols' },
            { flag: '-C', label: 'Demangle' },
            { flag: '-g', label: 'Extern Only' },
        ],
        defaultFlags: [],
    },
    {
        name: 'strings',
        flags: [
            { flag: '-a', label: 'Scan Entire File' },
        ],
        defaultFlags: [],
    },
    {
        name: 'readelf',
        flags: [
            { flag: '-a', label: 'All' },
            { flag: '-h', label: 'File Header' },
            { flag: '-l', label: 'Program Headers' },
            { flag: '-S', label: 'Section Headers' },
            { flag: '-s', label: 'Symbols' },
            { flag: '-r', label: 'Relocations' },
            { flag: '-d', label: 'Dynamic Section' },
        ],
        defaultFlags: ['-a'],
    },
    {
        name: 'size',
        flags: [
            { flag: '-A', label: 'System V Format' },
            { flag: '-B', label: 'Berkeley Format' },
            { flag: '-G', label: 'GNU Format' },
        ],
        defaultFlags: ['-A'],
    },
];

function App({ file }: { file: File }) {
    const [output, setOutput] = useState<string>('')
    const [selectedTool, setSelectedTool] = useState<string>('objdump');
    const [toolFlags, setToolFlags] = useState<{ [key: string]: string[] }>(
        Object.fromEntries(TOOLS.map((t) => [t.name, t.defaultFlags]))
    );
    const [chunkIndex, setChunkIndex] = useState<number>(0);
    const [reader] = useState(() => new FileChunkReader(file, 64 * 1024 * 1024));

    const totalChunks = reader.totalChunks;

    const binutil = async (tool: string, file: File, flags: string[] = [], currentChunk: number = 0) => {
        currentWorker?.terminate();
        const chunk = await reader.getChunk(currentChunk);
        setOutput(`Running ${tool} ${flags.join(' ')} on slice chunk ${currentChunk + 1}/${totalChunks} (${formatBytes(chunk.size)})...`);
        currentWorker = new Worker(new URL("worker.js", import.meta.url), { type: 'module' });
        const buffer = await chunk.data.arrayBuffer();
        let currentOutput = ''
        currentWorker.onmessage = (e) => {
            if (typeof e.data !== 'string') return;
            if (currentOutput === 'Running...') {
                currentOutput = ''
            }
            currentOutput += e.data + "\n"
            setOutput(currentOutput)
        }
        currentWorker.postMessage({ action: tool, buffer, flags, fileName: file.name }, [buffer]);
    };

    useEffect(() => {
        if (file) {
            binutil(selectedTool, file, toolFlags[selectedTool] || [], chunkIndex);
        }
    }, [selectedTool, toolFlags, file, chunkIndex]);


    const handleFlagChange = (toolName: string, flag: string, checked: boolean) => {
        setToolFlags(prev => {
            const currentFlags = prev[toolName] || [];
            const newFlags = checked
                ? [...currentFlags, flag]
                : currentFlags.filter(f => f !== flag);
            return { ...prev, [toolName]: newFlags };
        });
    };

    const currentToolInfo = TOOLS.find(t => t.name === selectedTool);

    return (
        <div className="binutils-root">
            <Sidebar
                tools={TOOLS}
                selectedTool={selectedTool}
                onSelect={setSelectedTool}
            />
            <main className="binutils-main">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#1e1e1e', color: '#ccc', fontSize: '13px', borderBottom: '1px solid #333' }}>
                    <div>
                        <span>File Size: {formatBytes(file.size)}</span>
                        {totalChunks > 1 && <span> | Chunk Slice: {chunkIndex + 1} of {totalChunks}</span>}
                    </div>
                    {totalChunks > 1 && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                disabled={chunkIndex === 0}
                                onClick={() => setChunkIndex(i => Math.max(0, i - 1))}
                                style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px', cursor: 'pointer', padding: '2px 8px' }}
                            >
                                Prev Chunk
                            </button>
                            <button
                                disabled={chunkIndex >= totalChunks - 1}
                                onClick={() => setChunkIndex(i => Math.min(totalChunks - 1, i + 1))}
                                style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px', cursor: 'pointer', padding: '2px 8px' }}
                            >
                                Next Chunk
                            </button>
                        </div>
                    )}
                </div>
                {currentToolInfo && (
                    <Controls
                        toolName={selectedTool}
                        flags={currentToolInfo.flags}
                        selectedFlags={toolFlags[selectedTool] || []}
                        onFlagChange={handleFlagChange}
                    />
                )}
                <div className="binutils-output">
                    <AceEditor
                        value={output}
                        mode="lisp"
                        theme="twilight"
                        name="output-editor"
                        fontSize={14}
                        editorProps={{ $blockScrolling: true }}
                        setOptions={{
                            showLineNumbers: true,
                            showGutter: true,
                            readOnly: true,
                            highlightActiveLine: false,
                            showPrintMargin: false,
                            wrapEnabled: true
                        }}
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
            </main>
        </div>
    )
}
