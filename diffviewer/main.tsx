import { createRoot } from 'react-dom/client'
import React, { useEffect, useState } from 'react'
import { RespondFileMessage } from 'common/messages';
import * as jsdiff from 'diff';

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' });
}

window.onmessage = (e: MessageEvent<RespondFileMessage>) => {
    if (e.data.action === 'respondFile') {
        handleFiles(e.data.file, e.data.additionalFiles || [])
    }
}

const ROOT_ELEMENT = document.getElementById('output');
if (!ROOT_ELEMENT) {
    throw new Error("Output element not found");
}
const ROOT = createRoot(ROOT_ELEMENT);

async function handleFiles(file: File, additionalFiles: File[]) {
    if (additionalFiles.length === 0) {
        ROOT.render(<div>Need at least two files to diff.</div>);
        return;
    }

    const file1 = file;
    const file2 = additionalFiles[0];

    try {
        const text1 = await file1.text();
        const text2 = await file2.text();

        const diffs = jsdiff.diffLines(text1, text2);

        ROOT.render(
            <div id="diff-container" style={{ padding: '20px', fontFamily: 'monospace' }}>
                <div style={{ marginBottom: '10px' }}>
                    <strong>Diffing:</strong> {file1.name} (left) vs {file2.name} (right)
                </div>
                <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #ccc', padding: '10px' }}>
                    {diffs.map((part, index) => {
                        const color = part.added ? 'green' : part.removed ? 'red' : 'black';
                        const backgroundColor = part.added ? '#e6ffec' : part.removed ? '#ffebe9' : 'transparent';
                        const prefix = part.added ? '+' : part.removed ? '-' : ' ';
                        const className = part.added ? 'diff-code-inserted' : part.removed ? 'diff-code-deleted' : '';

                        return (
                            <div key={index} className={className} style={{ color, backgroundColor }}>
                                {part.value.split('\n').filter((line, i, arr) => i < arr.length - 1 || line.length > 0).map((line, i) => (
                                    <div key={i}>{prefix}{line}</div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    } catch (err) {
        console.error('Error generating diff:', err);
        ROOT.render(<div>Error generating diff: {String(err)}</div>);
    }
}
