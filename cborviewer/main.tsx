import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { processData } from './cbor';

// Request file from parent window
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' });
}

const CBORViewer: React.FC = () => {
    const [cborInput, setCborInput] = useState<Uint8Array | null>(null);
    const [output, setOutput] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                try {
                    const file = e.data.file as File;
                    const arrayBuffer = await file.arrayBuffer();
                    setCborInput(new Uint8Array(arrayBuffer));
                    setOutput(''); // Clear previous output
                    setError(''); // Clear previous error
                } catch (err) {
                    setError(`Error reading file: ${err.message}`);
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
                setOutput('');
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
                setOutput('');
            } finally {
                setIsProcessing(false);
            }
        };

        processCbor();
    }, [cborInput]);

    return (
        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', padding: '20px' }}>
            <h3>CBOR Diagnostic Notation</h3>
            <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto', padding: '10px', minHeight: '200px' }}>
                {isProcessing ? (
                    <div style={{ color: '#666' }}>Processing...</div>
                ) : error ? (
                    <div style={{ color: 'red' }}>{error}</div>
                ) : output ? (
                    <pre>{output}</pre>
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