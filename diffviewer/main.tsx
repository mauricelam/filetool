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
        const [buf1, buf2] = await Promise.all([
            file1.arrayBuffer(),
            file2.arrayBuffer()
        ]);
        const uint8_1 = new Uint8Array(buf1);
        const uint8_2 = new Uint8Array(buf2);

        const isBinary = (buf: Uint8Array) => {
            for (let i = 0; i < Math.min(buf.length, 8192); i++) {
                if (buf[i] === 0) return true;
            }
            return false;
        }

        const initialMode = (isBinary(uint8_1) || isBinary(uint8_2)) ? 'binary' : 'text';

        ROOT.render(<DiffViewer file1={file1} file2={file2} buf1={uint8_1} buf2={uint8_2} initialMode={initialMode} />);
    } catch (err) {
        console.error('Error generating diff:', err);
        ROOT.render(<div>Error generating diff: {String(err)}</div>);
    }
}

function DiffViewer({ file1, file2, buf1, buf2, initialMode }: { file1: File, file2: File, buf1: Uint8Array, buf2: Uint8Array, initialMode: 'text' | 'binary' }) {
    const [viewMode, setViewMode] = useState<'unified' | 'side-by-side'>('unified');
    const [diffMode, setDiffMode] = useState<'text' | 'binary'>(initialMode);

    const text1 = new TextDecoder().decode(buf1);
    const text2 = new TextDecoder().decode(buf2);
    const textDiffs = React.useMemo(() => jsdiff.diffLines(text1, text2), [text1, text2]);
    const byteDiffs = React.useMemo(() => diffMode === 'binary' ? jsdiff.diffArrays(Array.from(buf1), Array.from(buf2)) : [], [buf1, buf2, diffMode]);

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

    const renderUnified = (diffs: jsdiff.Change[]) => (
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

    const renderSideBySide = (diffs: jsdiff.Change[]) => {
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
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', border: '1px solid #ccc', borderRadius: '4px', padding: '2px' }}>
                        <button
                            onClick={() => setDiffMode('text')}
                            style={{
                                padding: '2px 8px',
                                fontSize: '12px',
                                backgroundColor: diffMode === 'text' ? '#666' : '#fff',
                                color: diffMode === 'text' ? '#fff' : '#666',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                        >Text</button>
                        <button
                            onClick={() => setDiffMode('binary')}
                            style={{
                                padding: '2px 8px',
                                fontSize: '12px',
                                backgroundColor: diffMode === 'binary' ? '#666' : '#fff',
                                color: diffMode === 'binary' ? '#fff' : '#666',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                        >Binary</button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            disabled={diffMode === 'binary'}
                            onClick={() => setViewMode('unified')}
                            style={{
                                padding: '4px 8px',
                                backgroundColor: viewMode === 'unified' && diffMode === 'text' ? '#0066cc' : '#fff',
                                color: viewMode === 'unified' && diffMode === 'text' ? '#fff' : '#0066cc',
                                border: '1px solid #0066cc',
                                borderRadius: '4px',
                                cursor: diffMode === 'binary' ? 'not-allowed' : 'pointer',
                                opacity: diffMode === 'binary' ? 0.5 : 1
                            }}
                        >Unified</button>
                        <button
                            disabled={diffMode === 'binary'}
                            onClick={() => setViewMode('side-by-side')}
                            style={{
                                padding: '4px 8px',
                                backgroundColor: viewMode === 'side-by-side' && diffMode === 'text' ? '#0066cc' : '#fff',
                                color: viewMode === 'side-by-side' && diffMode === 'text' ? '#fff' : '#0066cc',
                                border: '1px solid #0066cc',
                                borderRadius: '4px',
                                cursor: diffMode === 'binary' ? 'not-allowed' : 'pointer',
                                opacity: diffMode === 'binary' ? 0.5 : 1
                            }}
                        >Side-by-Side</button>
                    </div>
                </div>
            </div>
            {diffMode === 'text' ? (viewMode === 'unified' ? renderUnified(textDiffs) : renderSideBySide(textDiffs)) : <BinaryDiffViewer file1={file1} file2={file2} diffs={byteDiffs} />}
        </div>
    );
}

function BinaryDiffViewer({ file1, file2, diffs }: { file1: File, file2: File, diffs: jsdiff.Change[] }) {
    const leftBytes: { value: number, type: 'normal' | 'removed' | 'empty' }[] = [];
    const rightBytes: { value: number, type: 'normal' | 'added' | 'empty' }[] = [];

    diffs.forEach(part => {
        const bytes = part.value as unknown as number[];
        if (part.added) {
            bytes.forEach(b => {
                rightBytes.push({ value: b, type: 'added' });
            });
        } else if (part.removed) {
            bytes.forEach(b => {
                leftBytes.push({ value: b, type: 'removed' });
            });
        } else {
            while (leftBytes.length < rightBytes.length) leftBytes.push({ value: 0, type: 'empty' });
            while (rightBytes.length < leftBytes.length) rightBytes.push({ value: 0, type: 'empty' });
            bytes.forEach(b => {
                leftBytes.push({ value: b, type: 'normal' });
                rightBytes.push({ value: b, type: 'normal' });
            });
        }
    });
    while (leftBytes.length < rightBytes.length) leftBytes.push({ value: 0, type: 'empty' });
    while (rightBytes.length < leftBytes.length) rightBytes.push({ value: 0, type: 'empty' });

    const leftRef = React.useRef<HTMLDivElement>(null);
    const rightRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const left = leftRef.current;
        const right = rightRef.current;
        if (!left || !right) return;

        let isSyncingLeft = false;
        let isSyncingRight = false;

        const handleScrollLeft = () => {
            if (!isSyncingLeft) {
                isSyncingRight = true;
                right.scrollTop = left.scrollTop;
                setTimeout(() => { isSyncingRight = false; }, 0);
            }
        };

        const handleScrollRight = () => {
            if (!isSyncingRight) {
                isSyncingLeft = true;
                left.scrollTop = right.scrollTop;
                setTimeout(() => { isSyncingLeft = false; }, 0);
            }
        };

        left.addEventListener('scroll', handleScrollLeft);
        right.addEventListener('scroll', handleScrollRight);

        return () => {
            left.removeEventListener('scroll', handleScrollLeft);
            right.removeEventListener('scroll', handleScrollRight);
        };
    }, []);

    return (
        <div style={{ display: 'flex', border: '1px solid #ccc', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
            <HexDiffPane fileName={file1.name} bytes={leftBytes} scrollRef={leftRef} />
            <HexDiffPane fileName={file2.name} bytes={rightBytes} scrollRef={rightRef} />
        </div>
    );
}

function HexDiffPane({ fileName, bytes, scrollRef }: { fileName: string, bytes: { value: number, type: 'normal' | 'removed' | 'added' | 'empty' }[], scrollRef: React.RefObject<HTMLDivElement> }) {
    const lineCount = Math.ceil(bytes.length / 16);
    const lines = [];
    for (let i = 0; i < lineCount; i++) {
        lines.push(bytes.slice(i * 16, i * 16 + 16));
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #ccc', overflow: 'hidden' }}>
            <div style={{ padding: '4px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ccc', fontWeight: 'bold', fontSize: '12px' }}>{fileName}</div>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.2' }}>
                <div style={{ display: 'flex' }}>
                    <div style={{ color: '#888', marginRight: '16px', userSelect: 'none' }}>
                        {Array.from({ length: lineCount }).map((_, i) => (
                            <div key={i}>{(i * 16).toString(16).padStart(8, '0')}</div>
                        ))}
                    </div>
                    <div style={{ marginRight: '16px' }}>
                        {lines.map((line, i) => (
                            <div key={i} style={{ display: 'flex' }}>
                                {line.map((b, j) => (
                                    <span key={j} style={{
                                        width: '2ch',
                                        marginRight: '1ch',
                                        backgroundColor: b.type === 'added' ? '#e6ffec' : b.type === 'removed' ? '#ffebe9' : 'transparent',
                                        color: b.type === 'empty' ? 'transparent' : (b.type === 'added' ? 'green' : b.type === 'removed' ? 'red' : 'black')
                                    }}>
                                        {b.type === 'empty' ? '  ' : b.value.toString(16).padStart(2, '0').toUpperCase()}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div style={{ borderLeft: '1px solid #eee', paddingLeft: '8px' }}>
                        {lines.map((line, i) => (
                            <div key={i}>
                                {line.map((b, j) => (
                                    <span key={j} style={{
                                        backgroundColor: b.type === 'added' ? '#e6ffec' : b.type === 'removed' ? '#ffebe9' : 'transparent',
                                        color: b.type === 'empty' ? 'transparent' : (b.type === 'added' ? 'green' : b.type === 'removed' ? 'red' : 'black')
                                    }}>
                                        {b.type === 'empty' ? ' ' : ((b.value > 31 && b.value < 127) || b.value > 159 ? String.fromCharCode(b.value) : '.')}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
