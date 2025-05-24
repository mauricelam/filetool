import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import * as jq from 'jq-wasm';

// Request file from parent window
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' });
}

const App: React.FC = () => {
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [jqQuery, setJqQuery] = useState<string>('.'); // Default query
    const [output, setOutput] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [jqVersion, setJqVersion] = useState<string | null>(null);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                try {
                    const file = e.data.file as File;
                    setFileName(file.name);
                    const textContent = await file.text();
                    setFileContent(textContent);
                    setOutput(null); // Clear previous output
                    setError(null); // Clear previous error
                } catch (err) {
                    setError(`Error reading file: ${err.message}`);
                    setFileContent(null);
                }
            }
        };
        window.addEventListener('message', handleMessage);

        // Load jq version
        jq.version().then(setJqVersion).catch(err => setError(`Failed to load jq: ${err.message}`));

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleRunQuery = async () => {
        if (fileContent === null) {
            setError('No file loaded.');
            return;
        }
        setError(null);
        setOutput(null);
        try {
            // Try to parse the input as JSON. If it's JSONL, jq-wasm should handle it.
            let inputData: any = fileContent;
            try {
                // If it's a single JSON object/array file, parse it.
                // jq-wasm's jq.json can also take a string directly.
                // Forcing JSON.parse here might be too strict if jq is to handle non-strict JSON or multiple objects (JSONL).
                // Let's pass the raw string content to jq.json, as it's designed to handle it.
            } catch (parseError) {
                // Not a single JSON object, could be JSONL or invalid. jq will tell.
            }

            const result = await jq.json(inputData, jqQuery, ['--color-output']); // Enable color by default
            
            if (typeof result === 'string') {
                setOutput(result);
            } else if (result === null && fileContent.trim() !== '' && jqQuery.trim() !== '') {
                // If result is null but there was input and a query, it might mean no results from jq
                 setOutput("null (no output from jq or input was empty after query)");
            }
            else {
                 // jq.json can return multiple results as an array for JSONL, or a single parsed object.
                 // We need to stringify it for display.
                setOutput(JSON.stringify(result, null, 2));
            }

        } catch (err) {
            setError(`JQ Error: ${err.message}
${err.stderr || ''}`);
            setOutput(null);
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '10px' }}>
            <div style={{ marginBottom: '10px' }}>
                <strong>File:</strong> {fileName || 'No file loaded'}
                {jqVersion && <small style={{ marginLeft: '10px' }}>(jq version: {jqVersion})</small>}
            </div>
            <div style={{ marginBottom: '10px' }}>
                <label htmlFor="jqQuery" style={{ marginRight: '5px' }}>JQ Query:</label>
                <input
                    type="text"
                    id="jqQuery"
                    value={jqQuery}
                    onChange={(e) => setJqQuery(e.target.value)}
                    style={{ width: 'calc(100% - 100px)', padding: '5px' }}
                />
                <button onClick={handleRunQuery} style={{ marginLeft: '5px', padding: '5px 10px' }}>Run</button>
            </div>
            {error && (
                <div style={{ marginBottom: '10px', padding: '10px', border: '1px solid red', backgroundColor: '#fee' }}>
                    <h4>Error</h4>
                    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{error}</pre>
                </div>
            )}
            {output !== null && (
                <div>
                    <h4>Output</h4>
                    {/* Using a div with pre-wrap for colored output from jq */}
                    <div
                        dangerouslySetInnerHTML={{ __html: output.replace(/\n/g, '<br/>') }}
                        style={{
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            fontFamily: 'monospace',
                            backgroundColor: '#f5f5f5',
                            padding: '10px',
                            border: '1px solid #ccc',
                            maxHeight: '60vh',
                            overflowY: 'auto'
                        }}
                    />
                </div>
            )}
             {output === null && !error && fileContent && (
                <div style={{ marginTop: '10px', fontStyle: 'italic'}}>
                    Enter a JQ query and click "Run".
                </div>
            )}
        </div>
    );
};

const container = document.getElementById('output');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
} else {
    console.error("Could not find root element 'output'");
}
