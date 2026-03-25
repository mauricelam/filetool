import { createRoot } from 'react-dom/client'
import React from 'react'
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

import { RespondFileMessage } from 'common/messages';

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' });
}

window.onmessage = (e: MessageEvent<RespondFileMessage>) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file, e.data.originalType)
    }
}

const OUTPUT = createRoot(document.getElementById('output')!)

async function handleFile(file: File, originalType?: string) {
    OUTPUT.render(<TextViewer content={await file.text()} filename={file.name} mimeType={originalType || file.type} />)
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

function TextViewer({ content, filename, mimeType }: { content: string, filename: string, mimeType: string }) {
    const mode = getAceMode(filename, mimeType);
    return (
        <AceEditor
            mode={mode}
            theme="monokai"
            value={content}
            readOnly={true}
            width="100%"
            height="100%"
            name="textviewer-editor"
            setOptions={{
                useWorker: false,
                showFoldWidgets: true,
                showPrintMargin: false,
            }}
        />
    )
}
