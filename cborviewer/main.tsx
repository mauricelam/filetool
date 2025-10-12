import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// Request file from parent window
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' });
}

const CBORViewer: React.FC = () => {
    const [cborInput, setCborInput] = useState<string>('');
    const [output, setOutput] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    // Initialize worker
    useEffect(() => {
        workerRef.current = new Worker(new URL('./cbor.worker.js', import.meta.url), { type: 'module' });

        workerRef.current.onmessage = (e) => {
            const { type, result, error, success } = e.data;

            switch (type) {
                case 'init':
                    if (!success) {
                        setError('Failed to initialize cbor-diag-rs: ' + error);
                    }
                    break;

                case 'process':
                    setIsProcessing(false);
                    if (error) {
                        setError(error);
                        setOutput('');
                    } else {
                        setOutput(result);
                        setError('');
                    }
                    break;
            }
        };

        // Initialize worker
        workerRef.current.postMessage({ type: 'init' });

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                try {
                    const file = e.data.file as File;
                    const arrayBuffer = await file.arrayBuffer();
                    const hexString = Array.from(new Uint8Array(arrayBuffer))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('');
                    setCborInput(hexString);
                    setOutput(''); // Clear previous output
                    setError(''); // Clear previous error
                } catch (err) {
                    setError(`Error reading file: ${err.message}`);
                    setCborInput('');
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
            if (!cborInput.trim()) {
                setOutput('');
                setError('');
                return;
            }

            setIsProcessing(true);
            workerRef.current?.postMessage({
                type: 'process',
                data: cborInput
            });
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