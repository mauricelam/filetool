import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as pdfjsLib from 'pdfjs-dist';
import { RespondFileMessage } from '../filemagic-common/messages';

// Set worker source
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';

function PDFViewer({ file }: { file: File }) {
    const [pdf, setPdf] = useState<any>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPDF = async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdfDoc = await loadingTask.promise;
                setPdf(pdfDoc);
                setNumPages(pdfDoc.numPages);
            } catch (err) {
                console.error('Error loading PDF:', err);
                setError('Error loading PDF: ' + (err instanceof Error ? err.message : String(err)));
            }
        };
        loadPDF();
    }, [file]);

    if (error) {
        return <div style={{ color: 'white', padding: '20px' }}>{error}</div>;
    }

    if (!pdf) {
        return <div style={{ color: 'white', padding: '20px' }}>Loading PDF...</div>;
    }

    return (
        <div className="pdf-container">
            {Array.from({ length: numPages }, (_, i) => (
                <PDFPage key={i + 1} pdf={pdf} pageNum={i + 1} />
            ))}
        </div>
    );
}

function PDFPage({ pdf, pageNum }: { pdf: any, pageNum: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const renderPage = async () => {
            try {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = canvasRef.current;
                if (!canvas) return;
                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };
                await page.render(renderContext).promise;
            } catch (err) {
                console.error(`Error rendering page ${pageNum}:`, err);
            }
        };
        renderPage();
    }, [pdf, pageNum]);

    return (
        <div className="pdf-page">
            <canvas ref={canvasRef} />
        </div>
    );
}

const container = document.getElementById('output');
if (container) {
    const root = createRoot(container);

    window.onmessage = (e: MessageEvent<RespondFileMessage>) => {
        if (e.data.action === 'respondFile') {
            root.render(<PDFViewer file={e.data.file} />);
        }
    };

    if (window.parent) {
        window.parent.postMessage({ action: 'requestFile' });
    }
}
