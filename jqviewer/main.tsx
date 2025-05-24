import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ReactJson from '@microlink/react-json-view';
import * as jqWasm from 'jq-wasm';

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

    // Check if content is JSONL format
    const isJSONL = (content: string): boolean => {
        const lines = content.trim().split('\n');
        if (lines.length <= 1) return false;
        
        try {
            // Try parsing each line as JSON
            return lines.every(line => {
                if (!line.trim()) return true; // Skip empty lines
                JSON.parse(line);
                return true;
            });
        } catch {
            return false;
        }
    };

    // Process JSONL content by wrapping in array
    const processJSONL = (content: string): string => {
        const lines = content.trim().split('\n')
            .filter(line => line.trim()) // Remove empty lines
            .map(line => line.trim());
        return `[${lines.join(',')}]`;
    };

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

        // Get jq version
        jqWasm.version().then(setJqVersion).catch((err) => {
            setError('Failed to load jq-wasm: ' + err.message);
        });

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

            try {
                // Check if input is JSONL and process accordingly
                const inputToProcess = isJSONL(jsonInput) ? processJSONL(jsonInput) : jsonInput;
                const result = await jqWasm.json(inputToProcess, jqFilter);
                setOutput(result);
                setError('');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
                setOutput(null);
            }
        };

        processJson();
    }, [jsonInput, jqFilter]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3>jq Filter</h3>
                <textarea
                    value={jqFilter}
                    onChange={(e) => setJqFilter(e.target.value)}
                    style={{ flex: 1, fontFamily: 'monospace', padding: '10px' }}
                    placeholder="Enter your jq filter here..."
                />
            </div>
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
                <h3>Output</h3>
                <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', overflow: 'auto', padding: '10px' }}>
                    {error ? (
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
