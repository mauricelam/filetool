import React, { useEffect, useState } from 'react';
import { getHandlerForFile } from '../file-type-detector';

// This is a placeholder. The actual file type will be more specific.
type PreviewableFile = {
    _name: string;
    extract: () => Promise<File>;
};

export const PreviewComponent: React.FC<{ file: PreviewableFile }> = ({ file }) => {
    const [preview, setPreview] = useState<{ url: string, file: File } | null>(null);

    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }

        const getHandler = async () => {
            const extractedFile = await file.extract();
            const handlerUrl = await getHandlerForFile(extractedFile);
            if (handlerUrl) {
                const fullUrl = `/${handlerUrl}/index.html`;
                setPreview({ url: fullUrl, file: extractedFile });
            }
        };

        getHandler();
    }, [file]);

    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data.action === 'requestFile' && preview && e.source && e.origin === window.origin) {
                const message = {
                    action: 'respondFile',
                    file: preview.file
                };
                (e.source as Window).postMessage(message, window.origin, [message.file as any]);
            }
        }
        window.addEventListener('message', handler)
        return () => window.removeEventListener('message', handler);
    }, [preview]);

    if (!file) {
        return null;
    }

    if (!preview || preview.file.name !== file._name) {
        return <div>Loading preview...</div>;
    }

    return <iframe src={preview.url} style={{ width: '100%', height: '100%', border: 0 }} />;
}
