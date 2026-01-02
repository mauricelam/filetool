import React, { useEffect, useState, useRef } from 'react';
import { getHandlersForFile, getDefaultHandler, setDefaultHandler, HandlerDefinition } from 'file-type-detector';

interface PreviewComponentProps {
    file: any;
    path: string[];
    extractFile: (file: any) => Promise<File>;
}

export const PreviewComponent: React.FC<PreviewComponentProps> = ({ file, path, extractFile }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [handlers, setHandlers] = useState<HandlerDefinition[]>([]);
    const [activeHandler, setActiveHandler] = useState<HandlerDefinition | null>(null);

    useEffect(() => {
        const getPreview = async () => {
            setError(null);
            setPreviewUrl(null);
            setPreviewFile(null);
            setActiveHandler(null);
            setHandlers([]);

            try {
                let extractedFile: File;
                if (file instanceof File) {
                    extractedFile = file;
                } else {
                    extractedFile = await extractFile(file);
                }

                const matchingHandlers = await getHandlersForFile(extractedFile);
                console.log("Matching handlers:", matchingHandlers);
                setHandlers(matchingHandlers);

                if (matchingHandlers.length > 0) {
                    const defaultHandlerId = getDefaultHandler(extractedFile.type, extractedFile.name);
                    console.log("Default handler ID:", defaultHandlerId);
                    let handlerToUse = matchingHandlers.find(h => h.handler === defaultHandlerId);
                    console.log("Handler after default check:", handlerToUse);

                    if (!handlerToUse) {
                        // Prefer handlers with specific mime/filename rules
                        handlerToUse = matchingHandlers.find(h =>
                            h.mimetypes.some(m => typeof m === 'object' && (m.mime || m.filename))
                        );
                        console.log("Handler after specific check:", handlerToUse);
                    }
                    if (!handlerToUse) {
                        // Fallback to the first handler
                        handlerToUse = matchingHandlers[0];
                        console.log("Handler after fallback:", handlerToUse);
                    }
                    setActiveHandler(handlerToUse);
                    setPreviewUrl(`/${handlerToUse.handler}/`);
                } else {
                    setError('No preview available');
                }
                setPreviewFile(extractedFile);

            } catch (e) {
                console.error('Error rendering file preview:', e);
                setError('Could not extract file for preview');
            }
        };
        getPreview();
    }, [file, path, extractFile]);

    const handleIframeLoad = () => {
        if (iframeRef.current && previewFile) {
            iframeRef.current.contentWindow?.postMessage({
                action: 'respondFile',
                file: previewFile,
            }, '/', [previewFile.slice()]);
        }
    };

    const handleHandlerChange = (handlerId: string) => {
        const newHandler = handlers.find(h => h.handler === handlerId);
        if (newHandler) {
            setActiveHandler(newHandler);
            setPreviewUrl(`/${newHandler.handler}/`);
        }
    };

    if (error) {
        return <div style={{ padding: '10px' }}>{error}</div>;
    }

    if (!activeHandler) {
        return <div style={{ padding: '10px' }}>Loading preview...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '8px', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="handler-select" style={{ fontSize: '12px' }}>Viewer:</label>
                <select
                    id="handler-select"
                    value={activeHandler.handler}
                    onChange={(e) => handleHandlerChange(e.target.value)}
                    style={{ fontSize: '12px' }}
                >
                    {handlers.map(h => <option key={h.handler} value={h.handler}>{h.name}</option>)}
                </select>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
                <iframe
                    ref={iframeRef}
                    src={previewUrl || ''}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    onLoad={handleIframeLoad}
                    key={previewUrl}
                />
            </div>
        </div>
    );
};
