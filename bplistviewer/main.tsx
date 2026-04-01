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
        <div style={{
            padding: '16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333'
        }}>
            {error && (
                <div style={{
                    backgroundColor: '#fff5f5',
                    color: '#c92a2a',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    borderRadius: '8px',
                    border: '1px solid #ffc9c9',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '15px' }}>Error</strong>
                    {error}
                </div>
            )}
            {warnings.length > 0 && (
                <div style={{
                    backgroundColor: '#fff9db',
                    color: '#e67700',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    borderRadius: '8px',
                    border: '1px solid #ffe066',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '15px' }}>Warning</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {warnings.map((w, i) => <li key={i} style={{ marginBottom: '2px' }}>{w}</li>)}
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
