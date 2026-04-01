import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ReactJson from '@microlink/react-json-view';
import { Buffer } from 'buffer';
import { parseBuffer } from './parser';

const App = () => {
    const [data, setData] = useState<Record<string, unknown> | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        window.onmessage = async (e) => {
            if (e.data.action === 'respondFile') {
                try {
                    setError(null);
                    const file = e.data.file;
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const [parsed, warnings] = parseBuffer(buffer);
                    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
                        setError(parsed.error);
                        setData(null);
                    } else {
                        setData(parsed);
                        setError(null);
                    }
                    setWarnings(warnings);
                } catch (err) {
                    console.error(err);
                    if (err instanceof Error) {
                        setError(err.message);
                    } else {
                        setError(String(err));
                    }
                    setData(null);
                }
            }
        };

        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }
    }, []);

    return (
        <div style={{ padding: '10px' }}>
            {error && (
                <div style={{
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                    border: '1px solid #f5c6cb'
                }}>
                    <strong>Error:</strong> {error}
                </div>
            )}
            {warnings.length > 0 && (
                <div style={{
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ffeeba'
                }}>
                    <strong>Warning:</strong>
                    <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
            )}
            {data ? (
                <ReactJson src={data} name={false} />
            ) : (
                !error && <p>Loading...</p>
            )}
        </div>
    );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container!);
root.render(<App />);
