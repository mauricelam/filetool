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

import { RespondFileMessage, safeReadFile, formatBytes } from '@filetool/common';

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
    if (e.data && e.data.action === 'respondFile') {
        handleFile(e.data.file, e.data.originalType)
    }
}

const OUTPUT = createRoot(document.getElementById('output')!)

async function handleFile(file: File, originalType?: string) {
    const { buffer, isTruncated, totalSize } = await safeReadFile(file, { maxBytes: 50 * 1024 * 1024 });
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const content = textDecoder.decode(buffer);
    OUTPUT.render(
        <TextViewer
            content={content}
            filename={file.name}
            mimeType={originalType || file.type}
            isTruncated={isTruncated}
            totalSize={totalSize}
            loadedSize={buffer.length}
        />
    );
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

function TextViewer({
    content,
    filename,
    mimeType,
    isTruncated,
    totalSize,
    loadedSize
}: {
    content: string;
    filename: string;
    mimeType: string;
    isTruncated?: boolean;
    totalSize?: number;
    loadedSize?: number;
}) {
    const [mode, setMode] = useState(() => getAceMode(filename, mimeType));

    useEffect(() => {
        setMode(getAceMode(filename, mimeType));
    }, [filename, mimeType]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            {isTruncated && totalSize !== undefined && (
                <div id="truncation-warning" style={{
                    padding: '8px 12px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    borderBottom: '1px solid #ffeeba',
                    fontSize: '13px',
                    fontFamily: 'sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>⚠️ File is too large ({formatBytes(totalSize)}). Showing preview of first {formatBytes(loadedSize || 0)}.</span>
                </div>
            )}
            <div style={{
                padding: '4px 8px',
                background: '#272822',
                borderBottom: '1px solid #444',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '8px'
            }}>
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
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <AceEditor
                    mode={mode}
                    theme="monokai"
                    value={content}
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
