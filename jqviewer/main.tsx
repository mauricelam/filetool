import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import ReactJson from '@microlink/react-json-view';

// Request file from parent window
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' });
}

const JQViewer: React.FC = () => {
    const [jsonInput, setJsonInput] = useState<string>('');
    const [jqFilter, setJqFilter] = useState<string>('.');
    const [output, setOutput] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [jqVersion, setJqVersion] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const workerRef = useRef<Worker | null>(null);

    // Initialize worker
    useEffect(() => {
        workerRef.current = new Worker(new URL('./jq.worker.js', import.meta.url), { type: 'module' });

        workerRef.current.onmessage = (e) => {
            const { type, result, error, version, success } = e.data;

            switch (type) {
                case 'init':
                    if (success) {
                        // Get version after successful initialization
                        workerRef.current?.postMessage({ type: 'version' });
                    } else {
                        setError('Failed to initialize jq-wasm: ' + error);
                    }
                    break;

                case 'version':
                    if (version) {
                        setJqVersion(version);
                    } else {
                        setError('Failed to get jq version: ' + error);
                    }
                    break;

                case 'process':
                    setIsProcessing(false);
                    if (error) {
                        setError(error);
                        setOutput(null);
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
                    const textContent = await file.text();
                    setJsonInput(textContent);
                    setOutput(null); // Clear previous output
                    setError(null); // Clear previous error
                } catch (err) {
                    setError(`Error reading file: ${err.message}`);
                    setJsonInput(null);
                }
            }
        };
        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    useEffect(() => {
        const processJson = async () => {
            if (!jsonInput.trim()) {
                setOutput(null);
                setError('');
                return;
            }

            setIsProcessing(true);
            workerRef.current?.postMessage({
                type: 'process',
                data: {
                    input: jsonInput,
                    filter: jqFilter
                }
            });
        };

        processJson();
    }, [jsonInput, jqFilter]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'row', flex: 0 }}>
                <label>jq: </label><textarea
                    ref={textareaRef}
                    value={jqFilter}
                    onChange={(e) => setJqFilter(e.target.value)}
                    style={{
                        fontFamily: 'monospace',
                        padding: '10px',
                        resize: 'none',
                        overflow: 'hidden',
                    }}
                    placeholder="Enter your jq filter here..."
                />
            </div>
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
                <h3>Output</h3>
                <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto', padding: '10px' }}>
                    {isProcessing ? (
                        <div style={{ padding: '10px', color: '#666' }}>Processing...</div>
                    ) : error ? (
                        <div style={{ color: 'red', padding: '10px' }}>{error}</div>
                    ) : output !== null ? (
                        <ReactJson
                            src={output}
                            theme="rjv-default"
                            name={false}
                            collapsed={1}
                            enableClipboard={true}
                            displayDataTypes={false}
                            style={{ backgroundColor: 'transparent' }}
                        />
                    ) : null}
                </div>
            </div>
            {jqVersion && (
                <div style={{ textAlign: 'right', color: '#666' }}>
                    jq version: {jqVersion}
                </div>
            )}
        </div>
    );
};

const container = document.getElementById('output');
if (container) {
    const root = createRoot(container);
    root.render(<JQViewer />);
} else {
    console.error("Could not find root element 'output'");
}
