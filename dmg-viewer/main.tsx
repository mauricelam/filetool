import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import init, { parse_dmg, DmgInfo, Partition } from './dmg-wasm/pkg';

const DMGViewer: React.FC = () => {
    const [dmgInfo, setDmgInfo] = useState<DmgInfo | null>(null);
    const [fileName, setFileName] = useState<string>('image.dmg');
    const [error, setError] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        const wasmPromise = init().catch(err => {
            console.error("Failed to initialize WASM module:", err);
            setError(`Failed to initialize WASM module: ${err}`);
            throw err;
        });

        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                setIsProcessing(true);
                setError('');
                setDmgInfo(null);

                try {
                    const file = e.data.file as File;
                    setFileName(file.name || 'image.dmg');
                    console.log(`Processing DMG file: ${file.name} (${file.size} bytes)`);

                    await wasmPromise;

                    // Slice trailer (last 512 bytes) to read koly block offsets
                    if (file.size >= 512) {
                        const trailerSlice = file.slice(file.size - 512, file.size);
                        const trailerBuf = await trailerSlice.arrayBuffer();
                        const view = new DataView(trailerBuf);
                        const magic = String.fromCharCode(...new Uint8Array(trailerBuf, 0, 4));

                        if (magic === 'koly') {
                            const xmlOffset = view.getBigUint64(216, false);
                            const xmlLength = view.getBigUint64(224, false);
                            const xmlSlice = file.slice(Number(xmlOffset), Number(xmlOffset) + Number(xmlLength));
                            const xmlBuf = new Uint8Array(await xmlSlice.arrayBuffer());
                            const info = parse_dmg(xmlBuf);
                            setDmgInfo(info);
                            return;
                        }
                    }

                    // Fallback to reading full file
                    const arrayBuffer = await file.arrayBuffer();
                    const fileData = new Uint8Array(arrayBuffer);
                    const info = parse_dmg(fileData);
                    setDmgInfo(info);

                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error('Error processing DMG file:', err);
                    setError(`Error processing DMG file: ${msg}`);
                } finally {
                    setIsProcessing(false);
                }
            }
        };

        window.addEventListener('message', handleMessage);

        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const openPlistInParent = () => {
        if (!dmgInfo || !dmgInfo.plist_xml) return;
        const plistName = fileName.replace(/\.dmg$/i, '') + '.plist';
        const plistFile = new File([dmgInfo.plist_xml], plistName, { type: 'application/x-plist' });
        if (window.parent) {
            window.parent.postMessage({ action: 'openFile', file: plistFile }, '*');
        }
    };

    const openPartitionPayloadInParent = (p: Partition) => {
        const sanitize = (s: string) => s.replace(/[^a-z0-9_-]/gi, '_');
        const payloadName = `${fileName.replace(/\.dmg$/i, '')}_${sanitize(p.name || 'partition')}_payload.bin`;
        const payloadFile = new File([new Uint8Array(p.data)], payloadName, { type: 'application/octet-stream' });
        if (window.parent) {
            window.parent.postMessage({ action: 'openFile', file: payloadFile }, '*');
        }
    };

    const renderContent = () => {
        if (isProcessing) {
            return <div style={{ color: '#666' }}>Processing...</div>;
        }
        if (error) {
            return <div style={{ color: 'red' }}>{error}</div>;
        }
        if (dmgInfo) {
            return (
                <div>
                    <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                            onClick={openPlistInParent}
                            style={{
                                padding: '8px 14px',
                                backgroundColor: '#0066cc',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 500,
                                fontSize: '13px'
                            }}
                        >
                            Open XML Plist in Parent
                        </button>
                    </div>

                    <h2>Partitions</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>ID</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Name</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>CFName</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Attributes</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Payload Size</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dmgInfo.partitions.map((p, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '8px' }}>{p.id}</td>
                                    <td style={{ padding: '8px' }}>{p.name}</td>
                                    <td style={{ padding: '8px' }}>{p.cf_name}</td>
                                    <td style={{ padding: '8px' }}>{p.attributes}</td>
                                    <td style={{ padding: '8px' }}>{p.data ? `${p.data.length.toLocaleString()} bytes` : '0 bytes'}</td>
                                    <td style={{ padding: '8px' }}>
                                        {p.data && p.data.length > 0 ? (
                                            <button
                                                onClick={() => openPartitionPayloadInParent(p)}
                                                style={{
                                                    padding: '4px 10px',
                                                    backgroundColor: '#f0f0f0',
                                                    color: '#333',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                Open Payload
                                            </button>
                                        ) : (
                                            <span style={{ color: '#aaa', fontSize: '12px' }}>Empty</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
