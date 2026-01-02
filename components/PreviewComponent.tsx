import React, { useEffect, useState, useRef } from 'react';
import { getHandlerForFile } from 'file-type-detector';

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

    useEffect(() => {
        const getPreview = async () => {
            setError(null);
            setPreviewUrl(null);
            setPreviewFile(null);

            try {
                let extractedFile: File;
                if (file instanceof File) {
                    extractedFile = file;
                } else {
                    extractedFile = await extractFile(file);
                }
                const handler = await getHandlerForFile(extractedFile);
                if (handler) {
                    setPreviewUrl(`/${handler.handler}/`);
                    setPreviewFile(extractedFile);
                } else {
                    setError('No preview available');
                }
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

    if (error) {
        return <div>{error}</div>;
    }

    if (!previewUrl) {
        return <div>Loading preview...</div>;
    }

    return (
        <iframe
            ref={iframeRef}
            src={previewUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            onLoad={handleIframeLoad}
            key={previewUrl} // Add key to force re-render on URL change
        />
    );
};
