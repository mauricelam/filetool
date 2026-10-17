import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ReactJson from '@microlink/react-json-view';
import { Buffer } from 'buffer';
import { parseBuffer, toXmlPlist } from './parser';

const App = () => {
    const [data, setData] = useState<Record<string, unknown> | null>(null);
    const [fileName, setFileName] = useState<string>('file.plist');
    const [warnings, setWarnings] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        window.onmessage = async (e) => {
            if (e.data.action === 'respondFile') {
                try {
                    setError(null);
                    const file = e.data.file;
                    if (file && file.name) {
                        setFileName(file.name);
                    }
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

    const getTextPlistFileName = () => {
        if (fileName.toLowerCase().endsWith('.bplist')) {
            return fileName.substring(0, fileName.length - 7) + '.plist';
        }
        if (!fileName.toLowerCase().endsWith('.plist')) {
            return `${fileName}.plist`;
        }
        return fileName;
    };

    const handleOpenAsTextPlist = () => {
        if (!data) return;
        const xmlContent = toXmlPlist(data);
        const textFileName = getTextPlistFileName();
        const textFile = new File([xmlContent], textFileName, { type: 'application/x-plist' });
        window.parent?.postMessage({
            action: 'openFile',
            file: textFile
        }, '*');
    };

    const handleDownloadAsTextPlist = () => {
        if (!data) return;
        const xmlContent = toXmlPlist(data);
        const textFileName = getTextPlistFileName();
        const blob = new Blob([xmlContent], { type: 'application/x-plist;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = textFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{
            padding: '16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333'
        }}>
            {data && (
                <div style={{
                    marginBottom: '16px',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={handleOpenAsTextPlist}
                        style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            fontWeight: 500,
                            borderRadius: '4px',
                            border: '1px solid #0066cc',
                            backgroundColor: '#0066cc',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Open as Text Plist
                    </button>
                    <button
                        onClick={handleDownloadAsTextPlist}
                        style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            fontWeight: 500,
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            backgroundColor: '#f8f9fa',
                            color: '#333',
                            cursor: 'pointer'
                        }}
                    >
                        Download as Text Plist
                    </button>
                </div>
            )}
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
