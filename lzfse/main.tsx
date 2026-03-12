
import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { OpenFileMessage } from 'filetool-common/messages';

// A simple hex viewer component to display the decompressed data.
const HexViewer: React.FC<{ data: ArrayBuffer }> = ({ data }) => {
    const hexString = useMemo(() => {
        const bytes = new Uint8Array(data);
        let result = '';
        for (let i = 0; i < bytes.length; i += 16) {
            const slice = bytes.slice(i, i + 16);
            const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const ascii = Array.from(slice).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
            result += `${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  |${ascii}|\n`;
        }
        return result;
    }, [data]);

    return <pre style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{hexString}</pre>;
};

const LzfseViewer: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [decompressedData, setDecompressedData] = useState<ArrayBuffer | null>(null);
    const [status, setStatus] = useState<string>('Initializing...');
    const [worker, setWorker] = useState<Worker | null>(null);

    const getHexdump = () => {
        if (!decompressedData) return '';
        const bytes = new Uint8Array(decompressedData);
        let result = '';
        for (let i = 0; i < bytes.length; i += 16) {
            const slice = bytes.slice(i, i + 16);
            const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const ascii = Array.from(slice).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
            result += `${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  |${ascii}|\n`;
        }
        return result;
    }

    const handleDownload = () => {
        if (decompressedData) {
            const blob = new Blob([decompressedData], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file?.name ? `${file.name}.decoded` : 'decoded_file';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleOpenInParent = () => {
        if (decompressedData && window.parent) {
            try {
                window.parent.postMessage({
                    action: 'openFile',
                    file: new File([decompressedData], file?.name ? `${file.name}.decoded` : 'decompressed.bin'),
                } as OpenFileMessage, '*', [decompressedData]);
                setStatus('Posted decompressed data to parent.');
            } catch (err) {
                setStatus(`Error posting decompressed data: ${err}`);
            }
        }
    };

    const handleCopyHexdump = () => {
        if (decompressedData) {
            const hexdump = getHexdump();
            navigator.clipboard.writeText(hexdump).then(() => {
                setStatus('Hexdump copied to clipboard.');
            }).catch(err => {
                setStatus(`Error copying hexdump: ${err}`);
            });
        }
    };

    useEffect(() => {
        setStatus('Initializing worker...');
        const newWorker = new Worker(new URL('worker.js', import.meta.url), { type: 'module' });
        setWorker(newWorker);

        const handleWorkerMessage = (event: MessageEvent) => {
            const { type, data, message } = event.data;
            switch (type) {
                case 'ready':
                    setStatus('Worker is ready. Requesting file...');
                    if (window.parent) {
                        window.parent.postMessage({ action: 'requestFile' }, '*');
                    }
                    break;
                case 'done':
                    setDecompressedData(data);
                    setStatus('Decompression successful.');
                    break;
                case 'error':
                    setStatus(`Error: ${message}`);
                    break;
                default:
                    console.warn('Unknown message from worker:', event.data);
            }
        };

        newWorker.addEventListener('message', handleWorkerMessage);

        // Listen for the file from the parent window.
        const handleParentMessage = (event: MessageEvent) => {
            if (event.data.action === 'respondFile') {
                setFile(event.data.file);
            }
        };
        window.addEventListener('message', handleParentMessage);

        return () => {
            newWorker.removeEventListener('message', handleWorkerMessage);
            window.removeEventListener('message', handleParentMessage);
            newWorker.terminate();
        };
    }, []);

    useEffect(() => {
        if (file && worker) {
            setStatus('File received. Decompressing...');
            worker.postMessage({ file });
        }
    }, [file, worker]);

    return (
        <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
            <h1>LZFSE Decompressor</h1>
            <p><strong>Status:</strong> {status}</p>
            {decompressedData && (
                <div>
                    <div style={{ marginBottom: '1rem' }}>
                        <button onClick={handleDownload} style={{ marginRight: '0.5rem' }}>Download</button>
                        <button onClick={handleOpenInParent} style={{ marginRight: '0.5rem' }}>Open in Parent</button>
                        <button onClick={handleCopyHexdump}>Copy Hexdump</button>
                    </div>
                    <h2>Decompressed Data (Hex View)</h2>
                    <HexViewer data={decompressedData} />
                </div>
            )}
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<LzfseViewer />);
}
