import React, { useEffect, useState, useRef } from 'react';
import { getHandlersForFile, getDefaultHandler, HandlerDefinition, sortHandlersBySpecificity } from 'file-type-detector';

interface PreviewComponentProps {
    path: string[];
    filePromise: () => Promise<File>;
}

export function PreviewComponent({ path, filePromise }: PreviewComponentProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [handlers, setHandlers] = useState<HandlerDefinition[]>([]);
    const [activeHandler, setActiveHandler] = useState<HandlerDefinition | null>(null);

    useEffect(() => {
        const getPreview = async () => {
            setError(null);
            setPreviewFile(null);
            setActiveHandler(null);
            setHandlers([]);

            try {
                const file = await filePromise();

                const matchingHandlers = await getHandlersForFile(file);
                console.log("Matching handlers:", matchingHandlers);
                const sortedHandlers = sortHandlersBySpecificity(matchingHandlers, file.type, file.name);
                console.log("Sorted handlers:", sortedHandlers);
                setHandlers(sortedHandlers);

                if (sortedHandlers.length > 0) {
                    const defaultHandlerId = getDefaultHandler(file.type, file.name);
                    console.log("Default handler ID:", defaultHandlerId);
                    let handlerToUse = sortedHandlers.find(h => h.handler === defaultHandlerId);
                    console.log("Handler after default check:", handlerToUse);

                    if (!handlerToUse) {
                        handlerToUse = sortedHandlers[0];
                        console.log("Handler after fallback:", handlerToUse);
                    }
                    setActiveHandler(handlerToUse);
                } else {
                    setError('No preview available');
                }
                setPreviewFile(file);

            } catch (e) {
                console.error('Error rendering file preview:', e);
                setError('Could not extract file for preview');
            }
        };
        getPreview();
    }, [path, filePromise]);

    const handleIframeLoad = async () => {
        if (iframeRef.current && previewFile) {
            iframeRef.current.contentWindow?.postMessage({
                action: 'respondFile',
                file: previewFile,
            }, '/', [await previewFile.arrayBuffer()]);
        }
    };

    const handleHandlerChange = (handlerId: string) => {
        const newHandler = handlers.find(h => h.handler === handlerId);
        if (newHandler) {
            setActiveHandler(newHandler);
        }
    };

    if (error) {
        return <div style={{ padding: '10px' }}>{error}</div>;
    }

    if (!activeHandler) {
        return <div style={{ padding: '10px' }}>Loading preview...</div>;
    }

    const previewUrl = `/${activeHandler.handler}/`;
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
                    src={previewUrl}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    onLoad={handleIframeLoad}
                    key={previewUrl}
                />
            </div>
        </div>
    );
};
