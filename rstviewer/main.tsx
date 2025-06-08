import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RstToHtmlCompiler, RstCompilerPlugin } from 'rst-compiler';

// Custom plugin to handle contents directive
const contentsPlugin: RstCompilerPlugin = {
    onInstall: (compiler) => {
        compiler.useDirectiveGenerator({
            directives: ['contents'],
            generate: (generatorState, node) => {
                // Generate a simple table of contents based on headers
                const toc = generatorState.visitNodes(node.children);
                return `<div class="contents">${toc}</div>`;
            },
        });
    },
};

// Initialize immediately when module loads
if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' }, '*');
    console.log('requested file');
}

// Register message handler at module level
window.addEventListener('message', (e: MessageEvent) => {
    if (e.data.action === 'respondFile') {
        const file = e.data.file;
        if (file) {
            // Render the component when file is received
            const root = document.getElementById('root');
            if (root) {
                const reactRoot = createRoot(root);
                reactRoot.render(<RstViewer file={file} />);
            }
        }
    }
});

function RstViewer({ file }: { file: File }) {
    const [htmlContent, setHtmlContent] = useState<{ header: string, body: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Process file when component mounts
    useEffect(() => {
        file.arrayBuffer().then(buffer => {
            try {
                const decoder = new TextDecoder('utf-8');
                const rstText = decoder.decode(buffer);

                const compiler = new RstToHtmlCompiler();
                compiler.usePlugin(contentsPlugin);
                const compiledHtml = compiler.compile(rstText);

                setHtmlContent(compiledHtml);
                setError(null);
            } catch (e: any) {
                console.error('Error processing .rst file:', e);
                setError(`Error processing ${file.name}: ${e.message}`);
                setHtmlContent(null);
            }
        });
    }, [file]);

    if (error) {
        return <div style={{ padding: '1em', color: 'red' }}>{error}</div>;
    }

    if (!htmlContent) {
        return <div style={{ padding: '1em' }}>Loading and processing {file.name}...</div>;
    }

    return (
        <div style={{ padding: '1em' }}>
            {htmlContent.header && (
                <div dangerouslySetInnerHTML={{ __html: htmlContent.header }} />
            )}
            <div dangerouslySetInnerHTML={{ __html: htmlContent.body }} />
        </div>
    );
}

export default RstViewer;
