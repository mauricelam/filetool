
import { ColorSpace, CompressionMethod, DensityUnit, ImageMagick, initializeImageMagick, Interlace, MagickFormat, IMagickImageInfo, MagickImageInfo, MagickReadSettings } from "@imagemagick/magick-wasm";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import wasm from "@imagemagick/magick-wasm/magick.wasm";
import { RespondFileMessage } from "filemagic-common/messages";

// Export the component for testing
export const ImageMagickApp = ({ file }: { file: File }) => {
    const [imageInfo, setImageInfo] = useState<IMagickImageInfo | null>(null);
    const [buf, setBuf] = useState<Uint8Array | null>(null);
    const [readSettings, setReadSettings] = useState<MagickReadSettings | null>(null);
    const [exifData, setExifData] = useState<Record<string, string>>({});

    useEffect(() => {
        const canvasEl = document.getElementById('canvas') as HTMLCanvasElement;

        const processFile = async () => {
            await initializeImageMagick(new URL(wasm, import.meta.url));
            const buffer = new Uint8Array(await file.arrayBuffer());
            const inputFormat = mimeTypeToFormat(file.type, file.name);
            const settings = new MagickReadSettings({ format: inputFormat });

            if (canvasEl) {
                ImageMagick.read(buffer, settings, (image) => {
                    image.writeToCanvas(canvasEl);

                    const exif: Record<string, string> = {};
                    for (const name of image.attributeNames) {
                        const value = image.getAttribute(name);
                        if (value) {
                            exif[name.substring(5)] = value;
                        }
                    }
                    setExifData(exif);
                });
            } else {
                ImageMagick.read(buffer, settings, (image) => {
                    const exif: Record<string, string> = {};
                    for (const name of image.attributeNames) {
                        const value = image.getAttribute(name);
                        if (value) {
                            exif[name.substring(5)] = value;
                        }
                    }
                    setExifData(exif);
                });
            }
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

                {Object.keys(exifData).length > 0 && (
                    <details style={{ marginTop: '12px' }}>
                        <summary style={{ cursor: 'pointer', padding: '4px 0', color: '#007aff', fontWeight: 'bold' }}>Metadata ({Object.keys(exifData).length})</summary>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
                            <tbody>
                                {Object.entries(exifData).map(([key, value]) => (
                                    <tr key={key} style={{ borderBottom: '1px solid #333' }}>
                                        <td style={{ padding: '6px 0', color: '#aaa', fontWeight: 'normal', fontSize: '12px' }}>{key}</td>
                                        <td style={{ padding: '6px 0', color: '#fff', fontSize: '12px', textAlign: 'right', wordBreak: 'break-all' }}>{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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

// Copied from magick-wasm/OrientationType$1
export enum OrientationType {
    Undefined = 0,
    TopLeft = 1,
    TopRight = 2,
    BottomRight = 3,
    BottomLeft = 4,
    LeftTop = 5,
    RightTop = 6,
    RightBottom = 7,
    LeftBottom = 8
}
