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

        ROOT.render(<DiffViewer file1={file1} file2={file2} diffs={diffs} />);
    } catch (err) {
        console.error('Error generating diff:', err);
        ROOT.render(<div>Error generating diff: {String(err)}</div>);
    }
}

function DiffViewer({ file1, file2, diffs }: { file1: File, file2: File, diffs: jsdiff.Change[] }) {
    const [viewMode, setViewMode] = useState<'unified' | 'side-by-side'>('unified');

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 1000) {
                setViewMode('side-by-side');
            } else {
                setViewMode('unified');
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const renderUnified = () => (
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
    );

    const renderSideBySide = () => {
        const leftLines: { text: string, type: 'normal' | 'removed' | 'empty' }[] = [];
        const rightLines: { text: string, type: 'normal' | 'added' | 'empty' }[] = [];

        diffs.forEach(part => {
            const lines = part.value.split('\n').filter((line, i, arr) => i < arr.length - 1 || line.length > 0);
            if (part.added) {
                lines.forEach(line => {
                    rightLines.push({ text: line, type: 'added' });
                });
            } else if (part.removed) {
                lines.forEach(line => {
                    leftLines.push({ text: line, type: 'removed' });
                });
            } else {
                // Align them
                while (leftLines.length < rightLines.length) leftLines.push({ text: '', type: 'empty' });
                while (rightLines.length < leftLines.length) rightLines.push({ text: '', type: 'empty' });
                lines.forEach(line => {
                    leftLines.push({ text: line, type: 'normal' });
                    rightLines.push({ text: line, type: 'normal' });
                });
            }
        });
        while (leftLines.length < rightLines.length) leftLines.push({ text: '', type: 'empty' });
        while (rightLines.length < leftLines.length) rightLines.push({ text: '', type: 'empty' });

        return (
            <div style={{ display: 'flex', border: '1px solid #ccc' }}>
                <div style={{ flex: 1, borderRight: '1px solid #ccc', overflowX: 'auto' }}>
                    <div style={{ padding: '4px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>{file1.name}</div>
                    <div style={{ padding: '10px' }}>
                        {leftLines.map((line, i) => (
                            <div key={i} className={line.type === 'removed' ? 'diff-code-deleted' : ''} style={{
                                backgroundColor: line.type === 'removed' ? '#ffebe9' : 'transparent',
                                color: line.type === 'removed' ? 'red' : (line.type === 'empty' ? 'transparent' : 'black'),
                                minHeight: '1.2em'
                            }}>{line.type === 'removed' ? '-' : (line.type === 'normal' ? ' ' : '')}{line.text || ' '}</div>
                        ))}
                    </div>
                </div>
                <div style={{ flex: 1, overflowX: 'auto' }}>
                    <div style={{ padding: '4px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>{file2.name}</div>
                    <div style={{ padding: '10px' }}>
                        {rightLines.map((line, i) => (
                            <div key={i} className={line.type === 'added' ? 'diff-code-inserted' : ''} style={{
                                backgroundColor: line.type === 'added' ? '#e6ffec' : 'transparent',
                                color: line.type === 'added' ? 'green' : (line.type === 'empty' ? 'transparent' : 'black'),
                                minHeight: '1.2em'
                            }}>{line.type === 'added' ? '+' : (line.type === 'normal' ? ' ' : '')}{line.text || ' '}</div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div id="diff-container" style={{ padding: '20px', fontFamily: 'monospace' }}>
            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <strong>Diffing:</strong> {file1.name} vs {file2.name}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setViewMode('unified')}
                        style={{
                            padding: '4px 8px',
                            backgroundColor: viewMode === 'unified' ? '#0066cc' : '#fff',
                            color: viewMode === 'unified' ? '#fff' : '#0066cc',
                            border: '1px solid #0066cc',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >Unified</button>
                    <button
                        onClick={() => setViewMode('side-by-side')}
                        style={{
                            padding: '4px 8px',
                            backgroundColor: viewMode === 'side-by-side' ? '#0066cc' : '#fff',
                            color: viewMode === 'side-by-side' ? '#fff' : '#0066cc',
                            border: '1px solid #0066cc',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >Side-by-Side</button>
                </div>
            </div>
            {viewMode === 'unified' ? renderUnified() : renderSideBySide()}
        </div>
    );
}
