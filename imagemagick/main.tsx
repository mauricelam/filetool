
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid grey', padding: '8px' }}>
                <div>Color Space: {ColorSpace[imageInfo.colorSpace]}</div>
                <div>Compression: {CompressionMethod[imageInfo.compression]}</div>
                <div>Density: {imageInfo.density.x}{imageInfo.density.x !== imageInfo.density.y ? ` x ${imageInfo.density.y}` : ''} {DensityUnit[imageInfo.density.units]}</div>
                <div>Format: {imageInfo.format}</div>
                <div>Size: {imageInfo.width} x {imageInfo.height}px</div>
                <div>Interlace: {Interlace[imageInfo.interlace]}</div>
                <div>Orientation: {OrientationType[imageInfo.orientation]}</div>
                <div>Quality: {imageInfo.quality}</div>
                {Object.keys(exifData).length > 0 && (
                    <details>
                        <summary>Metadata ({Object.keys(exifData).length})</summary>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
                            <tbody>
                                {Object.entries(exifData).map(([key, value]) => (
                                    <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '4px', fontWeight: 'bold', fontSize: '12px' }}>{key}</td>
                                        <td style={{ padding: '4px', fontSize: '12px', wordBreak: 'break-all' }}>{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </details>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                <label>Convert to:</label>
                <select id="outputFormat" defaultValue={MagickFormat.Png} style={{ flexGrow: 1 }}>
                    {Object.values(MagickFormat).filter(v => v !== MagickFormat.Unknown).map(v => (<option key={v}>{v}</option>))}
                </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                <button
                    style={{ flexGrow: 1 }}
                    onClick={() => downloadAs((document.getElementById('outputFormat') as HTMLSelectElement).value as MagickFormat)}>
                    Download
                </button>
                <button
                    style={{ flexGrow: 1 }}
                    onClick={() => openInParent((document.getElementById('outputFormat') as HTMLSelectElement).value as MagickFormat)}>
                    Open in Parent
                </button>
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
