/**
 * Office Open XML (OOXML) Document Viewer
 *
 * Renders Microsoft Office documents (.docx, .xlsx, .pptx and legacy extensions .doc, .xls, .ppt)
 * using WebAssembly-powered parsers from `@silurus/ooxml`.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DocxViewer } from '@silurus/ooxml/docx';
import { XlsxViewer } from '@silurus/ooxml/xlsx';
import { PptxScrollViewer } from '@silurus/ooxml/pptx';

/**
 * Root React application component for OOXML Document Viewer.
 * Listens for file payload messages from the parent frame, determines the document format,
 * and instantiates the corresponding `@silurus/ooxml` viewer.
 */
function OOXMLViewerApp() {
    /** The active document file received from the parent iframe container. */
    const [file, setFile] = useState<File | null>(null);

    /** Error message state displayed if document loading or WASM parsing fails. */
    const [error, setError] = useState<string | null>(null);

    /** DOM container element ref in which the active OOXML viewer renders canvas or HTML elements. */
    const containerRef = useRef<HTMLDivElement>(null);

    /** Reference holding the active WASM viewer instance (DocxViewer, XlsxViewer, or PptxScrollViewer). */
    const currentViewerRef = useRef<DocxViewer | XlsxViewer | PptxScrollViewer | null>(null);

    /**
     * Side effect to set up communication with the parent window/frame.
     * Posts a `requestFile` message to `window.parent` and listens for `respondFile` message payload.
     */
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data && e.data.action === 'respondFile' && e.data.file) {
                setFile(e.data.file);
            }
        };

        window.addEventListener('message', handleMessage);

        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    /**
     * Main document loading effect.
     * Clears container contents, cleans up previous viewer instance, inspects filename extension
     * and MIME type to resolve format ('docx', 'xlsx', or 'pptx'), and initializes WASM parser.
     */
    useEffect(() => {
        if (!file || !containerRef.current) return;

        const container = containerRef.current;
        container.innerHTML = '';
        setError(null);

        if (currentViewerRef.current) {
            try {
                currentViewerRef.current.destroy();
            } catch (e) {
                console.warn('Error destroying previous viewer:', e);
            }
            currentViewerRef.current = null;
        }

        const fileName = file.name.toLowerCase();
        let format: 'docx' | 'xlsx' | 'pptx' = 'docx';

        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xlsm') || fileName.endsWith('.xlsb') || fileName.endsWith('.xltx') || fileName.endsWith('.xltm') || fileName.endsWith('.xls')) {
            format = 'xlsx';
        } else if (fileName.endsWith('.pptx') || fileName.endsWith('.pptm') || fileName.endsWith('.potx') || fileName.endsWith('.potm') || fileName.endsWith('.ppsx') || fileName.endsWith('.ppt')) {
            format = 'pptx';
        } else if (fileName.endsWith('.docx') || fileName.endsWith('.docm') || fileName.endsWith('.dotx') || fileName.endsWith('.dotm') || fileName.endsWith('.doc')) {
            format = 'docx';
        } else {
            if (file.type.includes('spreadsheet') || file.type.includes('excel')) {
                format = 'xlsx';
            } else if (file.type.includes('presentation') || file.type.includes('powerpoint')) {
                format = 'pptx';
            } else {
                format = 'docx';
            }
        }

        let isMounted = true;

        async function loadDocument() {
            try {
                const wasmUrl = (filename: string) => new URL(filename, window.location.href).href;
                const buffer = await file.arrayBuffer();

                if (format === 'xlsx') {
                    const xlsxViewer = new XlsxViewer(container, {
                        mode: 'main',
                        wasmUrl: wasmUrl('xlsx_parser_bg.wasm'),
                        enableElementSelection: true,
                    });
                    currentViewerRef.current = xlsxViewer;
                    await xlsxViewer.load(buffer);
                } else if (format === 'pptx') {
                    const pptxViewer = new PptxScrollViewer(container, {
                        mode: 'main',
                        wasmUrl: wasmUrl('pptx_parser_bg.wasm'),
                        enableTextSelection: true,
                        enableElementSelection: true,
                    });
                    currentViewerRef.current = pptxViewer;
                    await pptxViewer.load(buffer);
                } else {
                    const canvas = document.createElement('canvas');
                    canvas.style.display = 'block';
                    canvas.style.margin = '20px auto';
                    container.appendChild(canvas);
                    const docxViewer = new DocxViewer(canvas, {
                        mode: 'main',
                        wasmUrl: wasmUrl('docx_parser_bg.wasm'),
                    });
                    currentViewerRef.current = docxViewer;
                    await docxViewer.load(buffer);
                }
            } catch (err: any) {
                console.error('Failed to load OOXML document:', err);
                if (isMounted) {
                    setError(err?.message || 'Failed to render Office document.');
                }
            }
        }

        loadDocument();

        return () => {
            isMounted = false;
            if (currentViewerRef.current) {
                try {
                    currentViewerRef.current.destroy();
                } catch (e) {
                    console.warn('Error destroying viewer on cleanup:', e);
                }
                currentViewerRef.current = null;
            }
        };
    }, [file]);

    return (
        <div className="viewer-container">
            {error && <div className="error-message">Error: {error}</div>}
            <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />
        </div>
    );
}

const rootElement = document.getElementById('output');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<OOXMLViewerApp />);
}
