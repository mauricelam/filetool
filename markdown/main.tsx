import Markdown from 'react-markdown';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { safeReadText, formatBytes } from '@filetool/common';

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' });
}

window.onmessage = (e) => {
    if (e.data && e.data.action === 'respondFile') {
        handleFile(e.data.file);
    }
};

const OUTPUT = createRoot(document.getElementById('output')!);

async function handleFile(file: File) {
    const { text, isTruncated, totalSize } = await safeReadText(file);

    OUTPUT.render(
        <div style={{ padding: '20px' }}>
            {isTruncated && (
                <div id="truncation-warning" style={{
                    padding: '8px 12px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    borderRadius: '4px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    fontFamily: 'sans-serif'
                }}>
                    ⚠️ File is too large ({formatBytes(totalSize)}). Showing preview of loaded portion.
                </div>
            )}
            <Markdown>{text}</Markdown>
        </div>
    );
}
