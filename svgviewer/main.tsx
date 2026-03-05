import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { UncontrolledReactSVGPanZoom, INITIAL_VALUE } from 'react-svg-pan-zoom';
import { RespondFileMessage } from 'common/messages';

const SVGViewer: React.FC = () => {
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [viewerSize, setViewerSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [svgProps, setSvgProps] = useState<{ viewBox?: string; width?: string; height?: string }>({});
    const viewerRef = useRef<any>(null);

    useEffect(() => {
        const handleResize = () => {
            setViewerSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);

        const handleMessage = async (e: MessageEvent<RespondFileMessage>) => {
            if (e.data.action === 'respondFile') {
                try {
                    const content = await e.data.file.text();

                    // Basic SVG attribute extraction
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(content, 'image/svg+xml');
                    const svgElement = doc.querySelector('svg');

                    if (svgElement) {
                        setSvgProps({
                            viewBox: svgElement.getAttribute('viewBox') || undefined,
                            width: svgElement.getAttribute('width') || undefined,
                            height: svgElement.getAttribute('height') || undefined,
                        });
                        setSvgContent(content);
                    } else {
                        setError('Invalid SVG file: No <svg> tag found.');
                    }
                } catch (err) {
                    setError(`Failed to read SVG: ${err}`);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' }, '*');
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const downloadAsPng = () => {
        if (!svgContent) return;

        const img = new Image();
        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const width = img.naturalWidth || 800;
            const height = img.naturalHeight || 600;

            canvas.width = width * 2; // High DPI
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.fillStyle = 'white'; // Default background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);

            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = 'render.png';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        };
        img.src = url;
    };

    if (error) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '20px',
                textAlign: 'center',
                color: '#333'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ margin: '0 0 12px 0', color: '#d32f2f' }}>Error Loading SVG</h2>
                <div style={{
                    backgroundColor: '#fdecea',
                    color: '#d32f2f',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    maxWidth: '450px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    border: '1px solid #f5c6cb'
                }}>
                    {error}
                </div>
            </div>
        );
    }

    if (!svgContent) {
        return <div style={{ padding: '20px' }}>Loading SVG...</div>;
    }

    // Extract the inner content of the SVG to inject it into the viewer's SVG element
    const innerContent = svgContent.replace(/<svg[^>]*>|<\/svg>/g, '');

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 100,
                display: 'flex',
                gap: '8px'
            }}>
                <button
                    onClick={downloadAsPng}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#007aff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                    }}
                >
                    Download PNG
                </button>
            </div>
            <UncontrolledReactSVGPanZoom
                width={viewerSize.width}
                height={viewerSize.height}
                ref={viewerRef}
                background="#f0f0f0"
                SVGBackground="#fff"
                tool="pan"
                detectAutoPan={false}
            >
                <svg
                    width={svgProps.width || viewerSize.width}
                    height={svgProps.height || viewerSize.height}
                    viewBox={svgProps.viewBox}
                >
                    <g dangerouslySetInnerHTML={{ __html: innerContent }} />
                </svg>
            </UncontrolledReactSVGPanZoom>
        </div>
    );
};

const root = document.getElementById('root');
if (root) {
    createRoot(root).render(<SVGViewer />);
}
