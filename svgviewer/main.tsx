import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { UncontrolledReactSVGPanZoom, ReactSVGPanZoom } from 'react-svg-pan-zoom';
import { RespondFileMessage } from 'filemagic-common/messages';

interface SvgInfo {
    content: string;
    innerHTML: string;
    viewBox?: string;
    width?: string;
    height?: string;
}

/**
 * Parses SVG content and extracts necessary attributes and inner elements.
 */
function parseSvg(text: string): SvgInfo | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return null;
    return {
        content: text,
        innerHTML: svg.innerHTML,
        viewBox: svg.getAttribute('viewBox') || undefined,
        width: svg.getAttribute('width') || undefined,
        height: svg.getAttribute('height') || undefined,
    };
}

/**
 * Renders an SVG string to a PNG file and triggers a download.
 */
function downloadPng(info: SvgInfo) {
    const img = new Image();
    const blob = new Blob([info.content], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || (info.width ? parseFloat(info.width) : 800);
        const h = img.naturalHeight || (info.height ? parseFloat(info.height) : 600);
        canvas.width = w * 2; // High DPI
        canvas.height = h * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);
            const png = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = png;
            a.download = 'render.png';
            a.click();
        }
        URL.revokeObjectURL(url);
    };
    img.src = url;
}

const SVGViewer = ({ info }: { info: SvgInfo }) => {
    const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
    const viewerRef = useRef<ReactSVGPanZoom | null>(null);

    useEffect(() => {
        const r = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', r);
        return () => window.removeEventListener('resize', r);
    }, []);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
                <button onClick={() => downloadPng(info)} style={{
                    padding: '8px 16px', backgroundColor: '#007aff', color: 'white',
                    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold',
                    fontFamily: 'sans-serif'
                }}>Download PNG</button>
            </div>
            <UncontrolledReactSVGPanZoom
                width={size.w} height={size.h}
                ref={viewerRef}
                background="#f0f0f0" SVGBackground="#fff"
                tool="pan" detectAutoPan={false}
            >
                <svg width={info.width || size.w} height={info.height || size.h} viewBox={info.viewBox}>
                    <g dangerouslySetInnerHTML={{ __html: info.innerHTML }} />
                </svg>
            </UncontrolledReactSVGPanZoom>
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);

    const handleFile = async (file: File) => {
        try {
            const text = await file.text();
            const info = parseSvg(text);
            if (info) {
                root.render(<SVGViewer info={info} />);
            } else {
                root.render(<div style={{ padding: 20, fontFamily: 'sans-serif' }}>Invalid SVG file: No &lt;svg&gt; tag found.</div>);
            }
        } catch (err) {
            root.render(<div style={{ padding: 20, fontFamily: 'sans-serif' }}>Error reading file: {String(err)}</div>);
        }
    };

    window.addEventListener('message', (e: MessageEvent<RespondFileMessage>) => {
        if (e.data.action === 'respondFile') {
            handleFile(e.data.file);
        }
    });

    if (window.parent) {
        window.parent.postMessage({ action: 'requestFile' }, '*');
    }
}
