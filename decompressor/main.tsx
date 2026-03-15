
import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { OpenFileMessage } from 'filetool-common/messages';

const generateHexdump = (data: ArrayBuffer): string => {
    const bytes = new Uint8Array(data);
    let result = '';
    for (let i = 0; i < bytes.length; i += 16) {
        const slice = bytes.slice(i, i + 16);
        const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ');
        const ascii = Array.from(slice).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
        result += `${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  |${ascii}|\n`;
    }
    return result;
};

// A simple hex viewer component to display the decompressed data.
const HexViewer: React.FC<{ data: ArrayBuffer }> = ({ data }) => {
    const hexString = useMemo(() => generateHexdump(data), [data]);

    return <pre style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>{hexString}</pre>;
};

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const DecompressorViewer: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [decompressedData, setDecompressedData] = useState<ArrayBuffer | null>(null);
    const [status, setStatus] = useState<string>('Initializing...');
    const [worker, setWorker] = useState<Worker | null>(null);

    const getHexdump = () => {
        if (!decompressedData) return '';
        return generateHexdump(decompressedData);
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

    const compressionRatio = useMemo(() => {
        if (file && decompressedData) {
            const originalSize = file.size;
            const decompressedSize = decompressedData.byteLength;
            if (decompressedSize === 0) return '0';
            return ((1 - originalSize / decompressedSize) * 100).toFixed(1);
        }
        return null;
    }, [file, decompressedData]);

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #eee', paddingBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>Decompressor</h2>
                <div style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    backgroundColor: status.startsWith('Error') ? '#fee2e2' : '#f3f4f6',
                    color: status.startsWith('Error') ? '#b91c1c' : '#374151',
                    fontSize: '14px'
                }}>
                    {status}
                </div>
            </div>

            {file && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', fontSize: '14px', color: '#4b5563' }}>
                    <div style={{ padding: '6px 12px', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                        <span style={{ color: '#6b7280', fontWeight: 'bold', marginRight: '6px' }}>Compressed:</span>
                        <span style={{ fontWeight: '500' }}>{formatSize(file.size)}</span>
                    </div>
                    {decompressedData && (
                        <>
                            <div style={{ padding: '6px 12px', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                                <span style={{ color: '#6b7280', fontWeight: 'bold', marginRight: '6px' }}>Decompressed:</span>
                                <span style={{ fontWeight: '500' }}>{formatSize(decompressedData.byteLength)}</span>
                            </div>
                            <div style={{ padding: '6px 12px', backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                                <span style={{ color: '#6b7280', fontWeight: 'bold', marginRight: '6px' }}>Ratio:</span>
                                <span style={{ fontWeight: '500' }}>{compressionRatio}% savings</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {decompressedData && (
                <div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                        <button
                            onClick={handleDownload}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                                <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                            </svg>
                            Download
                        </button>
                        <button
                            onClick={handleOpenInParent}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'white',
                                color: '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                                <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z" />
                            </svg>
                            Open in Parent
                        </button>
                        <button
                            onClick={handleCopyHexdump}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'white',
                                color: '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                                <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0-33-23.5-56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
                            </svg>
                            Copy Hexdump
                        </button>
                    </div>
                    <h3 style={{ marginBottom: '12px' }}>Decompressed Data (Hex View)</h3>
                    <HexViewer data={decompressedData} />
                </div>
            )}
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<DecompressorViewer />);
}
