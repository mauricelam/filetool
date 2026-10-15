import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { processData } from './cbor';
import { RespondFileMessage, safeReadFile } from '@filetool/common';

if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' });
}

const CBORViewer: React.FC = () => {
    const [cborInput, setCborInput] = useState<Uint8Array | null>(null);
    const [output, setOutput] = useState<{ standard: string, verbose: string } | null>(null);
    const [view, setView] = useState<'standard' | 'verbose'>('standard');
    const [error, setError] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent<RespondFileMessage>) => {
            if (e.data && e.data.action === 'respondFile') {
                try {
                    const file = e.data.file as File;
                    const { buffer } = await safeReadFile(file);
                    setCborInput(buffer);
                    setOutput(null);
                    setError('');
                } catch (err: any) {
                    setError(`Error reading file: ${err?.message || err}`);
                    setCborInput(null);
                }
            }
        };
        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    useEffect(() => {
        const processCbor = async () => {
            if (!cborInput) {
                setOutput(null);
                setError('');
                return;
            }

            setIsProcessing(true);
            try {
                const result = await processData(cborInput);
                setOutput(result);
                setError('');
            } catch (e: any) {
                setError(`Error processing CBOR: ${e?.message ?? String(e)}`);
                setOutput(null);
            } finally {
                setIsProcessing(false);
            }
        };

        processCbor();
    }, [cborInput]);

    const activeStyle = { backgroundColor: '#ddd' };

    return (
        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', padding: '20px' }}>
            <div style={{ marginBottom: '10px' }}>
                <button onClick={() => setView('standard')} style={view === 'standard' ? activeStyle : {}}>Diagnostic</button>
                <button onClick={() => setView('verbose')} style={view === 'verbose' ? activeStyle : {}}>Verbose</button>
            </div>
            <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto', padding: '10px', minHeight: '200px' }}>
                {isProcessing ? (
                    <div style={{ color: '#666' }}>Processing...</div>
                ) : error ? (
                    <div style={{ color: 'red' }}>{error}</div>
                ) : output ? (
                    <pre>{view === 'standard' ? output.standard : output.verbose}</pre>
                ) : null}
            </div>
        </div>
    );
};

const container = document.getElementById('output');
if (container) {
    const root = createRoot(container);
    root.render(<CBORViewer />);
} else {
    console.error("Could not find root element 'output'");
}
