import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactSVGPanZoom, Tool, Value } from 'react-svg-pan-zoom';
import { RespondFileMessage, safeReadText, formatBytes } from '@filetool/common';

interface SvgInfo {
    content: string;
    innerHTML: string;
    viewBox?: string;
    width?: string;
    height?: string;
}

export function parseSvg(content: string): SvgInfo | null {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');

        if (!svgElement) return null;

        return {
            content,
            innerHTML: svgElement.innerHTML,
            viewBox: svgElement.getAttribute('viewBox') || undefined,
            width: svgElement.getAttribute('width') || undefined,
            height: svgElement.getAttribute('height') || undefined,
        };
    } catch (e) {
        console.error('Failed to parse SVG', e);
        return null;
    }
}

export function downloadSvgAsPng(svgContent: string, svgProps: Partial<SvgInfo>, backgroundColor: string): void {
    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
        const canvas = document.createElement('canvas');

        let width = img.naturalWidth || (svgProps.width ? parseFloat(svgProps.width) : 0);
        let height = img.naturalHeight || (svgProps.height ? parseFloat(svgProps.height) : 0);

        if ((width === 0 || height === 0) && svgProps.viewBox) {
            const vb = svgProps.viewBox.split(/[\s,]+/).map(parseFloat);
            if (vb.length === 4) {
                if (width === 0) width = vb[2];
                if (height === 0) height = vb[3];
            }
        }

        if (width === 0) width = 800;
        if (height === 0) height = 600;

        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (backgroundColor !== 'transparent') {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

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
    img.onerror = (e) => {
        console.error('Failed to load SVG into Image for PNG conversion', e);
    };
    img.src = url;
}

const SVGViewer: React.FC = () => {
    const [svgInfo, setSvgInfo] = useState<SvgInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [viewerSize, setViewerSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [bgColor, setBgColor] = useState('white');
    const [tool, setTool] = useState<Tool>('pan');
    const [value, setValue] = useState<Value | null>(null);
    const [isTruncated, setIsTruncated] = useState(false);
    const [totalSize, setTotalSize] = useState<number>(0);
    const viewerRef = useRef<ReactSVGPanZoom | null>(null);

    useEffect(() => {
        const handleResize = () => {
            setViewerSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);

        const handleMessage = async (e: MessageEvent<RespondFileMessage>) => {
            if (e.data && e.data.action === 'respondFile') {
                try {
                    const { text: content, isTruncated, totalSize } = await safeReadText(e.data.file);
                    setIsTruncated(isTruncated);
                    setTotalSize(totalSize);
                    const info = parseSvg(content);
                    if (info) {
                        setSvgInfo(info);
                        setError(null);
                    } else {
                        setError('Invalid SVG file: No <svg> tag found.');
                    }
                } catch (err) {
                    setError(`Failed to read SVG: ${String(err)}`);
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

    useEffect(() => {
        if (svgInfo && viewerRef.current) {
            viewerRef.current.fitToViewer();
        }
    }, [svgInfo]);

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
                color: '#333',
                fontFamily: 'sans-serif'
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

    if (!svgInfo) {
        return <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>Loading SVG...</div>;
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            {isTruncated && (
                <div id="truncation-warning" style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 1001,
                    padding: '8px 12px',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'sans-serif'
                }}>
                    ⚠️ SVG is too large ({formatBytes(totalSize)}). Showing preview of loaded portion.
                </div>
            )}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 1000,
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                padding: '8px',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                fontFamily: 'sans-serif'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Background:</label>
                    <select
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        style={{ fontSize: '12px', padding: '2px' }}
                    >
                        <option value="transparent">Transparent</option>
                        <option value="white">White</option>
                        <option value="#f0f0f0">Gray</option>
                        <option value="black">Black</option>
                    </select>
                </div>
                <button
                    onClick={() => downloadSvgAsPng(svgInfo.content, svgInfo, bgColor)}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#007aff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '12px'
                    }}
                >
                    Download PNG
                </button>
            </div>
            <ReactSVGPanZoom
                width={viewerSize.width}
                height={viewerSize.height}
                ref={viewerRef}
                background="#f0f0f0"
                SVGBackground={bgColor === 'transparent' ? undefined : bgColor}
                tool={tool}
                onChangeTool={(t: Tool) => setTool(t)}
                value={value}
                onChangeValue={(v: Value) => setValue(v)}
                detectAutoPan={false}
            >
                <svg
                    width={(() => {
                        if (svgInfo.width) return parseFloat(svgInfo.width);
                        if (svgInfo.viewBox) {
                            const vb = svgInfo.viewBox.split(/[\s,]+/).map(parseFloat);
                            if (vb.length === 4) return vb[2];
                        }
                        return 800;
                    })()}
                    height={(() => {
                        if (svgInfo.height) return parseFloat(svgInfo.height);
                        if (svgInfo.viewBox) {
                            const vb = svgInfo.viewBox.split(/[\s,]+/).map(parseFloat);
                            if (vb.length === 4) return vb[3];
                        }
                        return 600;
                    })()}
                    viewBox={svgInfo.viewBox}
                >
                    <g dangerouslySetInnerHTML={{ __html: svgInfo.innerHTML }} />
                </svg>
            </ReactSVGPanZoom>
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<SVGViewer />);
}
