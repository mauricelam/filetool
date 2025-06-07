import React, { useEffect, useState }
from 'react';
import { RstToHtmlCompiler } from 'rst-compiler';

interface RstViewerProps {
    fileContent: ArrayBuffer;
    fileName: string;
}

const RstViewer: React.FC<RstViewerProps> = ({ fileContent, fileName }) => {
    const [htmlContent, setHtmlContent] = useState<{ header: string, body: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (fileContent) {
            try {
                const decoder = new TextDecoder('utf-8');
                const rstText = decoder.decode(fileContent);

                const compiler = new RstToHtmlCompiler();
                const compiledHtml = compiler.compile(rstText);

                setHtmlContent(compiledHtml);
                setError(null);
            } catch (e: any) {
                console.error('Error processing .rst file:', e);
                setError(`Error processing ${fileName}: ${e.message}`);
                setHtmlContent(null);
            }
        }
    }, [fileContent, fileName]);

    if (error) {
        return <div style={{ padding: '1em', color: 'red' }}>{error}</div>;
    }

    if (!htmlContent) {
        return <div style={{ padding: '1em' }}>Loading and processing {fileName}...</div>;
    }

    return (
        <div style={{ padding: '1em' }}>
            {htmlContent.header && (
                <div dangerouslySetInnerHTML={{ __html: htmlContent.header }} />
            )}
            <div dangerouslySetInnerHTML={{ __html: htmlContent.body }} />
        </div>
    );
};

export default RstViewer;
