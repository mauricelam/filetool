import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-ignore
import init, { BinwalkScanner, BinwalkResult } from './pkg/binwalk_wasm.js';

function BinwalkViewer() {
    const [file, setFile] = useState<File | null>(null);
    const [results, setResults] = useState<BinwalkResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [buffer, setBuffer] = useState<Uint8Array | null>(null);

    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                setFile(e.data.file);
            }
        };
        window.addEventListener('message', handleMessage);
        window.parent.postMessage({ action: 'requestFile' }, '*');
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        if (file) {
            analyzeFile(file);
        }
    }, [file]);

    async function analyzeFile(file: File) {
        setLoading(true);
        try {
            await init();
            const scanner = new BinwalkScanner();
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            setBuffer(data);
            const scanResults = scanner.scan(data) as BinwalkResult[];
            setResults(scanResults);
        } catch (e) {
            console.error("Binwalk analysis failed", e);
        } finally {
            setLoading(false);
        }
    }

    const handleOpen = (result: BinwalkResult) => {
        if (!buffer) return;

        let subData: Uint8Array;
        if (result.length > 0) {
            subData = buffer.slice(result.offset, result.offset + result.length);
        } else {
            // If length is unknown, we just take the rest of the file
            // Users can refine this in the hex viewer if needed
            subData = buffer.slice(result.offset);
        }

        const name = result.description.split(',')[0].replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const subFile = new File([subData], `${file?.name || 'file'}_0x${result.offset.toString(16)}_${name}.bin`);
        window.parent.postMessage({ action: 'openFile', file: subFile }, '*');
    };

    if (loading) {
        return <div className="loading">Analyzing file with binwalk...</div>;
    }

    if (results.length === 0 && !loading && file) {
        return <div className="no-results">No embedded files detected.</div>;
    }

    return (
        <table>
            <thead>
                <tr>
                    <th>Offset (Hex)</th>
                    <th>Offset (Dec)</th>
                    <th>Description</th>
                    <th>Size</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {results.map((result, i) => (
                    <tr key={i}>
                        <td className="offset">0x{result.offset.toString(16).toUpperCase()}</td>
                        <td>{result.offset}</td>
                        <td>{result.description}</td>
                        <td>{result.length > 0 ? result.length : 'Unknown'}</td>
                        <td>
                            <button className="primary" onClick={() => handleOpen(result)}>Open</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const root = document.getElementById('output');
if (root) {
    createRoot(root).render(<BinwalkViewer />);
}
