import { ColorSpace, CompressionMethod, DensityUnit, ImageMagick, initializeImageMagick, Interlace, MagickFormat, IMagickImageInfo, MagickImageInfo, MagickReadSettings, IMagickImage, OrientationType } from "@imagemagick/magick-wasm";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import wasm from "@imagemagick/magick-wasm/magick.wasm";
import { RespondFileMessage } from "filemagic-common/messages";
import { extractMotionPhotoInfo, MotionPhotoInfo } from "./motion-photo";

export const ImageMagickApp = ({ file }: { file: File }) => {
    const [imageInfo, setImageInfo] = useState<IMagickImageInfo | null>(null);
    const [buf, setBuf] = useState<Uint8Array | null>(null);
    const [readSettings, setReadSettings] = useState<MagickReadSettings | null>(null);
    const [metadata, setMetadata] = useState<Record<string, string>>({});
    const [motionPhotoInfo, setMotionPhotoInfo] = useState<MotionPhotoInfo | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const canvasEl = document.getElementById('canvas') as HTMLCanvasElement;

        const processFile = async () => {
            await initializeImageMagick(new URL(wasm, import.meta.url));
            const buffer = new Uint8Array(await file.arrayBuffer());
            const inputFormat = mimeTypeToFormat(file.type, file.name);
            const settings = new MagickReadSettings({ format: inputFormat });

            const onImageRead = (image: IMagickImage) => {
                if (canvasEl) {
                    image.writeToCanvas(canvasEl);
                }

                const meta: Record<string, string> = {};
                for (const name of image.attributeNames) {
                    const value = image.getAttribute(name);
                    if (value) {
                        meta[name] = value;
                    }
                }
                setMetadata(meta);

                const info = extractMotionPhotoInfo(image);
                setMotionPhotoInfo(info);
            };

            ImageMagick.read(buffer, settings, onImageRead);
            const info = MagickImageInfo.create(buffer, settings);

            setBuf(buffer);
            setReadSettings(settings);
            setImageInfo(info);
        };

        processFile();
    }, [file]);

    if (!imageInfo || !buf || !readSettings) {
        return <div>Loading...</div>;
    }

    const doConvert = (format: MagickFormat, cb: (file: File) => void) => {
        const data: Uint8Array = ImageMagick.read(buf, readSettings, (image) => {
            return image.write(format, (data: Uint8Array) => data);
        });
        const outputFile = new File([data.buffer as ArrayBuffer], `${getFileStem(file.name)}.${format.toLowerCase()}`);
        cb(outputFile);
    };

    const downloadAs = (format: MagickFormat) => {
        doConvert(format, (outputFile) => {
            const url = URL.createObjectURL(outputFile);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = outputFile.name;
            anchor.click();
        });
    };

    const openInParent = (format: MagickFormat) => {
        doConvert(format, (outputFile) => {
            window.parent.postMessage({ 'action': 'openFile', 'file': outputFile }, '*');
        });
    };

    const playMotionVideo = () => {
        if (!buf || !motionPhotoInfo?.microVideoOffset) return;

        const offset = parseInt(motionPhotoInfo.microVideoOffset);
        if (isNaN(offset)) return;

        const videoData = buf.slice(buf.length - offset);
        const blob = new Blob([videoData], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setShowModal(true);
    };

    const closeVideoModal = () => {
        setShowModal(false);
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl);
            setVideoUrl(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, minHeight: '100%', paddingBottom: '20px' }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                border: '1px solid #444',
                padding: '12px',
                borderRadius: '0px',
                background: '#1a1a1a',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'SF Mono, Monaco, Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#fff', fontSize: '14px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>Image Properties</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Color Space:</span> <span style={{ color: '#fff' }}>{ColorSpace[imageInfo.colorSpace]}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Compression:</span> <span style={{ color: '#fff' }}>{CompressionMethod[imageInfo.compression]}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Density:</span> <span style={{ color: '#fff' }}>{imageInfo.density.x}{imageInfo.density.x !== imageInfo.density.y ? ` x ${imageInfo.density.y}` : ''} {DensityUnit[imageInfo.density.units]}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Format:</span> <span style={{ color: '#fff' }}>{imageInfo.format}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Size:</span> <span style={{ color: '#fff' }}>{imageInfo.width} x {imageInfo.height}px</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Interlace:</span> <span style={{ color: '#fff' }}>{Interlace[imageInfo.interlace]}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Orientation:</span> <span style={{ color: '#fff' }}>{OrientationType[imageInfo.orientation]}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Quality:</span> <span style={{ color: '#fff' }}>{imageInfo.quality}</span></div>

                {motionPhotoInfo?.isMotionPhoto && (
                    <div style={{
                        marginTop: '12px',
                        padding: '10px',
                        background: 'rgba(0, 122, 255, 0.15)',
                        borderLeft: '4px solid #007aff',
                        borderRadius: '4px',
                        border: '1px solid rgba(0, 122, 255, 0.3)',
                        borderLeftWidth: '4px'
                    }}>
                        <div style={{ color: '#007aff', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                            Android Motion Photo
                        </div>
                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px', color: '#eee' }}>
                            {motionPhotoInfo.version && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Version:</span> {motionPhotoInfo.version}</div>}
                            {motionPhotoInfo.presentationTimestampUs && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Timestamp:</span> {motionPhotoInfo.presentationTimestampUs} µs</div>}
                            {motionPhotoInfo.microVideoOffset && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#aaa' }}>Video Offset:</span> {motionPhotoInfo.microVideoOffset} bytes</div>}
                            <div style={{ marginTop: '4px', fontStyle: 'italic', fontSize: '11px', color: '#007aff', borderTop: '1px solid rgba(0, 122, 255, 0.2)', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>This file contains an embedded video component.</span>
                                {motionPhotoInfo.microVideoOffset && (
                                    <button
                                        onClick={playMotionVideo}
                                        style={{
                                            background: '#007aff',
                                            color: 'white',
                                            border: 'none',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                        Play Video
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {Object.keys(metadata).length > 0 && (
                    <details style={{ marginTop: '12px' }}>
                        <summary style={{ cursor: 'pointer', padding: '4px 0', color: '#007aff', fontWeight: 'bold' }}>
                            Metadata ({Object.keys(metadata).length})
                        </summary>
                        <div style={{ marginTop: '8px' }}>
                            {Object.entries(
                                Object.entries(metadata).reduce((acc, [key, value]) => {
                                    const colonIndex = key.indexOf(':');
                                    const group = colonIndex !== -1 ? key.substring(0, colonIndex).toUpperCase() : 'OTHER';
                                    const tag = colonIndex !== -1 ? key.substring(colonIndex + 1) : key;
                                    if (!acc[group]) acc[group] = {};
                                    acc[group][tag] = value;
                                    return acc;
                                }, {} as Record<string, Record<string, string>>)
                            ).sort(([a], [b]) => a.localeCompare(b)).map(([group, tags]) => (
                                <div key={group} style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '4px', borderBottom: '1px solid #333' }}>{group}</div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            {Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                                <tr key={key} style={{ borderBottom: '1px solid #222' }}>
                                                    <td style={{ padding: '4px 0', color: '#aaa', fontSize: '11px', width: '40%' }}>{key}</td>
                                                    <td style={{ padding: '4px 0', color: '#fff', fontSize: '11px', textAlign: 'right', wordBreak: 'break-all' }}>{value}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', color: '#666', fontWeight: 'bold' }}>Convert to:</label>
                    <select id="outputFormat" defaultValue={MagickFormat.Png} style={{
                        flexGrow: 1,
                        background: '#fff',
                        color: '#333',
                        border: '1px solid #ccc',
                        padding: '6px',
                        borderRadius: '4px'
                    }}>
                        {Object.values(MagickFormat).filter(v => v !== MagickFormat.Unknown).map(v => (<option key={v}>{v}</option>))}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                    <button
                        style={{
                            flexGrow: 1,
                            background: '#007aff',
                            color: 'white',
                            border: 'none',
                            padding: '10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '13px'
                        }}
                        onClick={() => downloadAs((document.getElementById('outputFormat') as HTMLSelectElement).value as MagickFormat)}>
                        Download
                    </button>
                    <button
                        style={{
                            flexGrow: 1,
                            background: '#333',
                            color: 'white',
                            border: '1px solid #444',
                            padding: '10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '13px'
                        }}
                        onClick={() => openInParent((document.getElementById('outputFormat') as HTMLSelectElement).value as MagickFormat)}>
                        Open in Parent
                    </button>
                </div>
            </div>
            {showModal && videoUrl && (
                <VideoModal url={videoUrl} onClose={closeVideoModal} />
            )}
        </div>
    );
};

const VideoModal = ({ url, onClose }: { url: string, onClose: () => void }) => {
    const previousFocus = React.useRef<HTMLElement | null>(null);

    useEffect(() => {
        previousFocus.current = document.activeElement as HTMLElement;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (previousFocus.current) {
                previousFocus.current.focus();
            }
        };
    }, [onClose]);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)'
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                style={{
                    position: 'relative',
                    width: '90%',
                    maxWidth: '800px',
                    maxHeight: '90%',
                    background: '#000',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: '#1a1a1a',
                    borderBottom: '1px solid #333'
                }}>
                    <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Motion Photo Video</span>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#aaa',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                    <video
                        src={url}
                        controls
                        autoPlay
                        loop
                        style={{ maxWidth: '100%', maxHeight: '70vh' }}
                    />
                </div>
            </div>
        </div>
    );
};


// Main execution logic for the browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.onmessage = (e: MessageEvent<RespondFileMessage>) => {
        if (e.data.action === 'respondFile') {
            const outputEl = document.getElementById('output');
            if (outputEl) {
                const root = createRoot(outputEl);
                root.render(<ImageMagickApp file={e.data.file} />);
            }
        }
    };

    if (window.parent) {
        window.parent.postMessage({ 'action': 'requestFile' }, '*');
    }
}

export const MIME_FORMAT_MAP: { [key: string]: MagickFormat } = {
    "image/vnd.microsoft.icon": MagickFormat.Ico,
    "image/x-portable-pixmap": MagickFormat.Pnm,
    "image/tiff": MagickFormat.Tiff,
    "image/vnd.adobe.photoshop": MagickFormat.Psd,
    "image/heif": MagickFormat.Heif,
    "font/sfnt": MagickFormat.Ttf,
    "image/avif": MagickFormat.Avif,
    "image/png": MagickFormat.Png,
    "image/jpeg": MagickFormat.Jpeg,
    "image/gif": MagickFormat.Gif,
};

export function mimeTypeToFormat(mime: string, filename: string): MagickFormat | undefined {
    if (mime in MIME_FORMAT_MAP) {
        return MIME_FORMAT_MAP[mime];
    } else if (/.*\.raw/i.test(filename)) {
        return MagickFormat.Raw;
    }
    return undefined;
}

export function getFileStem(filename: string): string {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex === -1) {
        return filename;
    }
    return filename.slice(0, dotIndex);
}
