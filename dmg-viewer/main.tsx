import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import init, { parse_dmg, parse_koly_header, parse_dmg_xml, DmgInfo } from './dmg-wasm/pkg';
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
            .catch(err => {
                console.error("Failed to initialize WASM module:", err);
                setError(`Failed to initialize WASM module: ${err}`);
            });
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
                    console.log(`Processing DMG file: ${file.name} (${file.size} bytes)`);

                    if (file.size < 512) {
                        throw new Error('File is too small to be a valid DMG image');
                    }

                    // Slice trailer (last 512 bytes) to read koly block
                    const trailerSlice = file.slice(file.size - 512, file.size);
                    const trailerBuf = new Uint8Array(await trailerSlice.arrayBuffer());

                    try {
                        const koly = parse_koly_header(trailerBuf);
                        console.log(`Parsed DMG trailer: xml_offset=${koly.xml_offset}, xml_length=${koly.xml_length}`);
                        const xmlSlice = file.slice(Number(koly.xml_offset), Number(koly.xml_offset) + Number(koly.xml_length));
                        const xmlBuf = new Uint8Array(await xmlSlice.arrayBuffer());
                        const info = parse_dmg_xml(xmlBuf);
                        setDmgInfo(info);
                    } catch (headerErr) {
                        console.warn('Range slicing koly header failed, falling back to full file parse:', headerErr);
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
