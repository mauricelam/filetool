import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RstToHtmlCompiler, RstCompilerPlugin } from 'rst-compiler';
import { safeReadText, formatBytes } from '@filetool/common';

const contentsPlugin: RstCompilerPlugin = {
    onInstall: (compiler) => {
        compiler.useDirectiveGenerator({
            directives: ['contents'],
            generate: (generatorState, node) => {
                const toc = generatorState.visitNodes(node.children);
                return `<div class="contents">${toc}</div>`;
            },
        });
    },
};

if (window.parent) {
    window.parent.postMessage({ action: 'requestFile' }, '*');
    console.log('requested file');
}

window.addEventListener('message', (e: MessageEvent) => {
    if (e.data && e.data.action === 'respondFile') {
        const file = e.data.file;
        if (file) {
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
    const [isTruncated, setIsTruncated] = useState(false);
    const [totalSize, setTotalSize] = useState<number>(0);

    useEffect(() => {
        safeReadText(file).then(({ text: rstText, isTruncated, totalSize }) => {
            try {
                const compiler = new RstToHtmlCompiler();
                compiler.usePlugin(contentsPlugin);
                const compiledHtml = compiler.compile(rstText);

                setIsTruncated(isTruncated);
                setTotalSize(totalSize);
                setHtmlContent(compiledHtml);
                setError(null);
            } catch (e: any) {
                console.error('Error processing .rst file:', e);
                setError(`Error processing ${file.name}: ${e?.message || e}`);
                setHtmlContent(null);
            }
        }).catch(err => {
            setError(`Error reading file: ${err?.message || err}`);
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
            {isTruncated && (
                <div id="truncation-warning" style={{
                    padding: '8px 12px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    borderRadius: '4px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    fontFamily: 'sans-serif'
                }}>
                    ⚠️ File is too large ({formatBytes(totalSize)}). Showing preview of loaded portion.
                </div>
            )}
            {htmlContent.header && (
                <div dangerouslySetInnerHTML={{ __html: htmlContent.header }} />
            )}
            <div dangerouslySetInnerHTML={{ __html: htmlContent.body }} />
        </div>
    );
}

export default RstViewer;
