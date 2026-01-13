import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import init, { parse_dmg, DmgInfo } from './dmg-wasm/pkg';
// Request file from parent window
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' });
}

const DMGViewer: React.FC = () => {
    const [dmgInfo, setDmgInfo] = useState<DmgInfo | null>(null);
    const [error, setError] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(true);
    const [wasmInitialized, setWasmInitialized] = useState(false);

    useEffect(() => {
        init()
            .then(() => setWasmInitialized(true))
            .catch(err => setError(`Failed to initialize WASM module: ${err}`));
    }, []);

    useEffect(() => {
        if (!wasmInitialized) return;

        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                setIsProcessing(true);
                setError('');
                setDmgInfo(null);

                try {
                    const file = e.data.file as File;
                    const arrayBuffer = await file.arrayBuffer();
                    const fileData = new Uint8Array(arrayBuffer);

                    const info = parse_dmg(fileData);
                    setDmgInfo(info);

                } catch (err) {
                    setError(`Error processing DMG file: ${err}`);
                } finally {
                    setIsProcessing(false);
                }
            }
        };
        window.addEventListener('message', handleMessage);

        setIsProcessing(false);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [wasmInitialized]);

    const renderContent = () => {
        if (isProcessing) {
            return <div style={{ color: '#666' }}>Processing...</div>;
        }
        if (error) {
            return <div style={{ color: 'red' }}>{error}</div>;
        }
        if (dmgInfo) {
            return (
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>CFName</th>
                            <th>Attributes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dmgInfo.partitions.map((p, i) => (
                            <tr key={i}>
                                <td>{p.id}</td>
                                <td>{p.name}</td>
                                <td>{p.cf_name}</td>
                                <td>{p.attributes}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
        return <div>Waiting for file...</div>;
    };

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
            <h1>DMG File Information</h1>
            {renderContent()}
        </div>
    );
};

const container = document.getElementById('output');
if (container) {
    const root = createRoot(container);
    root.render(<DMGViewer />);
} else {
    console.error("Could not find root element 'output'");
}
