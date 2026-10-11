import { createRoot } from 'react-dom/client'
import React, { useState, useEffect } from 'react'
import AceEditor from 'react-ace';

import "ace-builds/src-noconflict/theme-monokai";

import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/mode-xml";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-yaml";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-sh";
import "ace-builds/src-noconflict/mode-rust";
import "ace-builds/src-noconflict/mode-golang";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/mode-ruby";
import "ace-builds/src-noconflict/mode-php";
import "ace-builds/src-noconflict/mode-csharp";
import "ace-builds/src-noconflict/mode-css";
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/mode-typescript";
import "ace-builds/src-noconflict/mode-properties";
import "ace-builds/src-noconflict/mode-ini";
import "ace-builds/src-noconflict/mode-diff";
import "ace-builds/src-noconflict/mode-text";

import { RespondFileMessage } from 'common/messages';

const SUPPORTED_MODES = [
    'text',
    'javascript',
    'typescript',
    'python',
    'java',
    'xml',
    'html',
    'json',
    'yaml',
    'c_cpp',
    'sh',
    'rust',
    'golang',
    'markdown',
    'ruby',
    'php',
    'csharp',
    'css',
    'sql',
    'properties',
    'ini',
    'diff'
].sort();

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' });
}

window.onmessage = (e: MessageEvent<RespondFileMessage>) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file, e.data.originalType)
    }
}

const OUTPUT = createRoot(document.getElementById('output')!)

import { FileChunkReader, formatBytes } from 'filetool-common/largeFile';

async function handleFile(file: File, originalType?: string) {
    OUTPUT.render(<TextViewer file={file} filename={file.name} mimeType={originalType || file.type} />)
}

function getAceMode(filename: string, mimeType: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (ext === 'js' || mimeType === 'application/javascript' || mimeType === 'text/javascript') return 'javascript';
    if (ext === 'ts' || ext === 'tsx') return 'typescript';
    if (ext === 'py') return 'python';
    if (ext === 'java') return 'java';
    if (ext === 'xml' || mimeType === 'application/xml' || mimeType === 'text/xml' || mimeType === 'image/svg+xml') return 'xml';
    if (ext === 'html' || ext === 'htm' || mimeType === 'text/html') return 'html';
    if (ext === 'json' || mimeType === 'application/json') return 'json';
    if (ext === 'yaml' || ext === 'yml') return 'yaml';
    if (ext === 'c' || ext === 'cpp' || ext === 'h' || ext === 'hpp' || ext === 'cc') return 'c_cpp';
    if (ext === 'sh' || ext === 'bash') return 'sh';
    if (ext === 'rs') return 'rust';
    if (ext === 'go') return 'golang';
    if (ext === 'md' || ext === 'markdown') return 'markdown';
    if (ext === 'rb') return 'ruby';
    if (ext === 'php') return 'php';
    if (ext === 'cs') return 'csharp';
    if (ext === 'css') return 'css';
    if (ext === 'sql') return 'sql';
    if (ext === 'properties') return 'properties';
    if (ext === 'ini') return 'ini';
    if (ext === 'diff' || ext === 'patch') return 'diff';

    return 'text';
}

function TextViewer({ file, filename, mimeType }: { file: File, filename: string, mimeType: string }) {
    const [mode, setMode] = useState(() => getAceMode(filename, mimeType));
    const [content, setContent] = useState<string>('');
    const [chunkIndex, setChunkIndex] = useState<number>(0);
    const [chunkReader] = useState(() => new FileChunkReader(file, 16 * 1024 * 1024));
    const [loading, setLoading] = useState<boolean>(true);

    const totalChunks = chunkReader.totalChunks;

    useEffect(() => {
        setMode(getAceMode(filename, mimeType));
    }, [filename, mimeType]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        chunkReader.getChunk(chunkIndex).then(async (chunkInfo) => {
            const text = await chunkInfo.data.text();
            if (active) {
                setContent(text);
                setLoading(false);
            }
        });
        return () => { active = false; };
    }, [chunkIndex, chunkReader]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <div style={{
                padding: '4px 8px',
                background: '#272822',
                borderBottom: '1px solid #444',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px'
            }}>
                <div style={{ color: '#ccc', fontSize: '12px', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Size: {formatBytes(file.size)}</span>
                    {totalChunks > 1 && (
                        <>
                            <span>| Chunk: {chunkIndex + 1} / {totalChunks}</span>
                            <button
                                disabled={chunkIndex === 0 || loading}
                                onClick={() => setChunkIndex(i => Math.max(0, i - 1))}
                                style={{ background: '#3e3d32', color: '#fff', border: '1px solid #75715e', borderRadius: '2px', cursor: 'pointer', padding: '1px 6px' }}
                            >
                                Prev
                            </button>
                            <button
                                disabled={chunkIndex >= totalChunks - 1 || loading}
                                onClick={() => setChunkIndex(i => Math.min(totalChunks - 1, i + 1))}
                                style={{ background: '#3e3d32', color: '#fff', border: '1px solid #75715e', borderRadius: '2px', cursor: 'pointer', padding: '1px 6px' }}
                            >
                                Next
                            </button>
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label htmlFor="mode-select" style={{ color: '#ccc', fontSize: '12px', fontFamily: 'sans-serif' }}>Language:</label>
                    <select
                        id="mode-select"
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        style={{
                            background: '#3e3d32',
                            color: '#f8f8f2',
                            border: '1px solid #75715e',
                            borderRadius: '2px',
                            fontSize: '12px',
                            padding: '2px 4px'
                        }}
                    >
                        {SUPPORTED_MODES.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <AceEditor
                    mode={mode}
                    theme="monokai"
                    value={loading ? 'Loading chunk slice...' : content}
                    readOnly={true}
                    width="100%"
                    height="100%"
                    name="textviewer-editor"
                    onLoad={(editor) => {
                        editor.container.id = 'textviewer';
                    }}
                    setOptions={{
                        useWorker: false,
                        showFoldWidgets: true,
                        showPrintMargin: false,
                    }}
                />
            </div>
        </div>
    )
}
