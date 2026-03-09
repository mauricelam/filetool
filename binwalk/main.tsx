import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface ScanResult {
    offset: number;
    description: string;
    name: string;
    confidence: number;
}

const App = () => {
    const [results, setResults] = useState<ScanResult[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                const file = e.data.file as File;
                setFileName(file.name);
                try {
                    // @ts-ignore
                    const { default: init, scan } = await import('./binwalk_wasm.js');
                    await init();
                    const buffer = await file.arrayBuffer();
                    const scanResults = scan(new Uint8Array(buffer)) as ScanResult[];
                    setResults(scanResults);
                } catch (err) {
                    console.error('Scan failed:', err);
                    setError(err instanceof Error ? err.message : String(err));
                }
            }
        };

        window.addEventListener('message', handleMessage);
        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    if (error) {
        return <div style={{ color: 'red' }}>Error: {error}</div>;
    }

    if (!results) {
        return <div>Processing {fileName || 'file'}...</div>;
    }

    return (
        <div>
            <h2>Binwalk Scan Results: {fileName}</h2>
            {results.length === 0 ? (
                <p>No signatures found.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Offset (Decimal)</th>
                            <th>Offset (Hex)</th>
                            <th>Name</th>
                            <th>Confidence</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((res, i) => (
                            <tr key={i}>
                                <td>{res.offset}</td>
                                <td>0x{res.offset.toString(16).toUpperCase()}</td>
                                <td>{res.name}</td>
                                <td>{res.confidence}</td>
                                <td>{res.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
