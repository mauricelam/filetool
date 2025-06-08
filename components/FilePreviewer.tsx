import React, { useState, useEffect, useRef } from 'react';
import { determineHandlers } from '../lib/magic/handlerMatcher';
import { HANDLERS, matchMimetype } from '../main/handlers'; // Assuming these are the defaults to be used

export interface FilePreviewerProps {
    fileDataProvider: () => Promise<File>;
    fileName: string; // Primarily for initial display or if fileDataProvider doesn't yield a name
    fullPath: string[];
}

export const FilePreviewer: React.FC<FilePreviewerProps> = ({
    fileDataProvider,
    fileName,
    fullPath,
}) => {
    const [fileForPreview, setFileForPreview] = useState<File | null>(null);
    const [selectedHandlerUrl, setSelectedHandlerUrl] = useState<string | null>(null);
    const [availableHandlersForSelection, setAvailableHandlersForSelection] = useState<any[]>([]);
    const [bestMatchHandler, setBestMatchHandler] = useState<any | null>(null); // Retain bestMatch for context if needed
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let alive = true;
        setIsLoading(true);
        setError(null);
        setSelectedHandlerUrl(null);
        setFileForPreview(null);
        setAvailableHandlersForSelection([]);
        setBestMatchHandler(null);

        const loadFileAndProcessHandlers = async () => {
            try {
                const file = await fileDataProvider();
                if (!alive) return;
                setFileForPreview(file);

                const result = determineHandlers(file, HANDLERS, matchMimetype);

                if (result.bestMatch) {
                    setBestMatchHandler(result.bestMatch);
                    setSelectedHandlerUrl(`/${result.bestMatch.handler}/index.html`);
                    setAvailableHandlersForSelection([]); // Clear selection list if best match is used
                } else if (result.allMatches.length > 0) {
                    setAvailableHandlersForSelection(result.allMatches);
                } else {
                    setError(`No suitable preview handler found for this file type (${file.type || 'unknown type'}).`);
                }
            } catch (e) {
                console.error("Error getting file data or finding handler:", e);
                if (alive) setError("Error loading file for preview.");
            } finally {
                if (alive) setIsLoading(false);
            }
        };

        loadFileAndProcessHandlers();
        return () => { alive = false; };
    }, [fileDataProvider]); // fileName and fullPath are passed to postMessage, not directly used in this effect's core logic after file is fetched.

    useEffect(() => {
        if (fileForPreview && selectedHandlerUrl && iframeRef.current) {
            const iframe = iframeRef.current;
            const sendData = async () => {
                try {
                    const data = await fileForPreview.arrayBuffer();
                    if (iframe.contentWindow) {
                        iframe.contentWindow.postMessage({
                            fileData: data,
                            fileName: fileForPreview.name,
                            filePath: fullPath,
                            action: 'displayFile'
                        }, window.origin, [data]);
                    } else {
                        console.warn("iframe contentWindow not available for postMessage (might be loading or cross-origin without proper setup)");
                    }
                } catch (e) {
                    console.error("Error sending data to iframe:", e);
                    if (!error) setError("Error sending data to preview handler.");
                }
            };

            const handleLoad = () => sendData();
            iframe.addEventListener('load', handleLoad);

            if (iframe.contentWindow && iframe.src !== 'about:blank' && iframe.ownerDocument.readyState === 'complete') {
                sendData();
            }

            return () => iframe.removeEventListener('load', handleLoad);
        }
    }, [fileForPreview, selectedHandlerUrl, fullPath, error]);

    const handleHandlerSelection = (handler: any) => {
        setSelectedHandlerUrl(`/${handler.handler}/index.html`);
        setBestMatchHandler(handler); // Treat explicitly selected as "best" for current view
        setAvailableHandlersForSelection([]);
    };

    if (error) {
        return <div style={{ padding: '10px', color: 'red', height: '100%', boxSizing: 'border-box' }}>{error}</div>;
    }

    if (isLoading) {
        return <div style={{ padding: '10px', height: '100%', boxSizing: 'border-box' }}>Loading file and determining handlers...</div>;
    }

    if (availableHandlersForSelection.length > 0 && !selectedHandlerUrl) {
        return (
            <div style={{ padding: '10px', height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
                <p>Multiple handlers available for {fileName}. Please choose one:</p>
                <ul>
                    {availableHandlersForSelection.map(handler => (
                        <li key={handler.name} style={{ marginBottom: '5px' }}>
                            <button onClick={() => handleHandlerSelection(handler)}>
                                Use {handler.name}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    if (selectedHandlerUrl && fileForPreview) {
        return (
            <iframe
                ref={iframeRef}
                src={selectedHandlerUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title={`Preview of ${fileForPreview.name}`}
                sandbox="allow-scripts allow-same-origin"
            />
        );
    }

    // Fallback or if no handler was auto-selected and selection list is empty (should ideally be covered by error state)
    return <div style={{ padding: '10px', height: '100%', boxSizing: 'border-box' }}>No preview available or selection pending.</div>;
};
