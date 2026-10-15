import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import init, { parse_dmg, DmgInfo } from './dmg-wasm/pkg';
const DMGViewer: React.FC = () => {
    const [dmgInfo, setDmgInfo] = useState<DmgInfo | null>(null);
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
                    console.log(`Processing DMG file: ${file.name} (${file.size} bytes)`);

                    if (file.size < 512) {
                        throw new Error('File is too small to be a valid DMG image');
                    }

                    await wasmPromise;

                    // Slice trailer (last 512 bytes) to read koly block offsets
                    const trailerSlice = file.slice(file.size - 512, file.size);
                    const trailerBuf = await trailerSlice.arrayBuffer();
                    const view = new DataView(trailerBuf);

                    // Check for "koly" magic at start of 512-byte trailer
                    const magic = String.fromCharCode(...new Uint8Array(trailerBuf, 0, 4));

                    if (magic === 'koly') {
                        const xmlOffset = view.getBigUint64(216, false); // Big-endian
                        const xmlLength = view.getBigUint64(224, false); // Big-endian
                        console.log(`Parsed DMG trailer offsets: xml_offset=${xmlOffset}, xml_length=${xmlLength}`);

                        const xmlSlice = file.slice(Number(xmlOffset), Number(xmlOffset) + Number(xmlLength));
                        const xmlBuf = new Uint8Array(await xmlSlice.arrayBuffer());
                        // parse_dmg handles both XML property list slices and full DMG files in Rust
                        const info = parse_dmg(xmlBuf);
                        setDmgInfo(info);
                    } else {
                        console.warn('Trailer does not start with koly magic, falling back to full file parse');
                        const arrayBuffer = await file.arrayBuffer();
                        const fileData = new Uint8Array(arrayBuffer);
                        const info = parse_dmg(fileData);
                        setDmgInfo(info);
                    }

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
