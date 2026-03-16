import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { getHandlersForFile, getDefaultHandler, HandlerDefinition } from 'file-type-detector';

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const DecompressorViewer: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [decompressedFile, setDecompressedFile] = useState<File | null>(null);
    const [compressionType, setCompressionType] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('Initializing...');
    const [worker, setWorker] = useState<Worker | null>(null);
    const [handlers, setHandlers] = useState<HandlerDefinition[]>([]);
    const [activeHandler, setActiveHandler] = useState<HandlerDefinition | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const newWorker = new Worker(new URL('worker.js', import.meta.url), { type: 'module' });
        setWorker(newWorker);

        const handleWorkerMessage = async (event: MessageEvent) => {
            const { type, data, format, message } = event.data;
            switch (type) {
                case 'ready':
                    setStatus('Ready. Requesting file...');
                    if (window.parent) {
                        window.parent.postMessage({ action: 'requestFile' }, '*');
                    }
                    break;
                case 'done':
                    setCompressionType(format);
                    setStatus('');

                    setDecompressedFile(prev => {
                        const fileName = file?.name ? `${file.name}.decoded` : 'decompressed.bin';
                        const decodedFile = new File([data], fileName);

                        // Async handler detection
                        getHandlersForFile(decodedFile).then(([mime, sortedHandlers]) => {
                            setHandlers(sortedHandlers);
                            if (sortedHandlers.length > 0) {
                                const defaultHandlerId = getDefaultHandler(mime, fileName);
                                const handlerToUse = sortedHandlers.find(h => h.handler === defaultHandlerId) || sortedHandlers[0];
                                setActiveHandler(handlerToUse);
                            }
                        });

                        return decodedFile;
                    });
                    break;
                case 'error':
                    setStatus(`Error: ${message}`);
                    break;
                default:
                    console.warn('Unknown message from worker:', event.data);
            }
        };

        newWorker.addEventListener('message', handleWorkerMessage);

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
    }, [file?.name]); // Only restart if filename changes, though even that might be unnecessary. [] is safer.

    useEffect(() => {
        if (file && worker) {
            setStatus('Decompressing...');
            worker.postMessage({ file });
        }
    }, [file, worker]);

    const compressionRatio = useMemo(() => {
        if (file && decompressedFile) {
            const originalSize = file.size;
            const decompressedSize = decompressedFile.size;
            if (decompressedSize === 0) return '0';
            return ((1 - originalSize / decompressedSize) * 100).toFixed(1);
        }
        return null;
    }, [file, decompressedFile]);

    const handleIframeLoad = async () => {
        if (iframeRef.current && decompressedFile) {
            const buffer = await decompressedFile.arrayBuffer();
            iframeRef.current.contentWindow?.postMessage({
                action: 'respondFile',
                file: decompressedFile,
            }, '/', [buffer]);
        }
    };

    const handleHandlerChange = (handlerId: string) => {
        const handler = handlers.find(h => h.handler === handlerId);
        if (handler) {
            setActiveHandler(handler);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'sans-serif', overflow: 'hidden' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 16px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '13px',
                color: '#475569',
                flexShrink: 0
            }}>
                <div style={{ fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
                        <path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM440-440h80v-80h80v-80h-80v-80h-80v80h-80v80h80v80ZM240-800v200-200 640-640Z"/>
                    </svg>
                    {decompressedFile?.name || (file ? file.name : 'Decompressing...')}
                </div>

                {compressionType && (
                    <div style={{ padding: '2px 8px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>
                        {compressionType}
                    </div>
                )}

                {decompressedFile && (
                    <>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <span>{formatSize(file?.size || 0)} → {formatSize(decompressedFile.size)}</span>
                            <span style={{ color: '#64748b' }}>({compressionRatio}% savings)</span>
                        </div>

                        <div style={{ flex: 1 }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <label htmlFor="handler-select" style={{ fontSize: '12px' }}>Open with:</label>
                            <select
                                id="handler-select"
                                value={activeHandler?.handler || ''}
                                onChange={(e) => handleHandlerChange(e.target.value)}
                                style={{ fontSize: '12px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                                {handlers.map(h => <option key={h.handler} value={h.handler}>{h.name}</option>)}
                            </select>
                        </div>
                    </>
                )}

                {status && (
                    <div style={{ marginLeft: 'auto', color: status.startsWith('Error') ? '#ef4444' : '#64748b', flexShrink: 0 }}>
                        {status}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, position: 'relative', backgroundColor: '#fff' }}>
                {activeHandler ? (
                    <iframe
                        ref={iframeRef}
                        src={`../${activeHandler.handler}`}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        onLoad={handleIframeLoad}
                        key={activeHandler.handler}
                    />
                ) : !status && decompressedFile && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                        No handler found for this file.
                    </div>
                )}
            </div>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<DecompressorViewer />);
}
