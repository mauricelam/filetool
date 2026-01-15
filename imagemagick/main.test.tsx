
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { ImageMagickApp } from './main'; // Import the component directly

// Mock the wasm module
vi.mock('@imagemagick/magick-wasm', () => ({
    ImageMagick: {
        read: vi.fn((_buf, _settings, cb) => {
            const imageMock = {
                writeToCanvas: vi.fn(),
                write: vi.fn((_format, writeCb) => writeCb(new Uint8Array([1, 2, 3]))),
                attributeNames: ['exif:Make', 'exif:Model', 'other:attribute'],
                getAttribute: vi.fn((name) => {
                    if (name === 'exif:Make') return 'MockMake';
                    if (name === 'exif:Model') return 'MockModel';
                    return null;
                }),
                getProfile: vi.fn(() => null)
            };
            cb(imageMock);
            return new Uint8Array([1, 2, 3]);
        }),
    },
    initializeImageMagick: vi.fn(() => Promise.resolve()),
    MagickImageInfo: {
        create: vi.fn(() => ({
            colorSpace: 0,
            compression: 0,
            density: { x: 0, y: 0, units: 0 },
            format: 'PNG',
            width: 100,
            height: 100,
            interlace: 0,
            orientation: 0,
            quality: 100,
        })),
    },
    MagickReadSettings: vi.fn(),
    MagickFormat: {
        Png: 'PNG',
        Jpeg: 'JPEG',
        Unknown: 'UNKNOWN'
    },
    ColorSpace: {},
    CompressionMethod: {},
    DensityUnit: {},
    Interlace: {},
    OrientationType: {
        Undefined: 0,
        TopLeft: 1,
        TopRight: 2,
        BottomRight: 3,
        BottomLeft: 4,
        LeftTop: 5,
        RightTop: 6,
        RightBottom: 7,
        LeftBottom: 8
    },
}));

vi.mock('@imagemagick/magick-wasm/magick.wasm', () => ({
    default: 'magick.wasm'
}));

describe('ImageMagickApp', () => {
    let file: File;

    beforeEach(() => {
        document.body.innerHTML = `<canvas id="canvas"></canvas>`;
        vi.clearAllMocks();
        window.parent.postMessage = vi.fn();

        // JSDOM's File object doesn't have arrayBuffer, so we need to add it.
        // This needs to be done before creating the File object.
        if (!Blob.prototype.arrayBuffer) {
            Blob.prototype.arrayBuffer = async function () {
                return new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as ArrayBuffer);
                    reader.readAsArrayBuffer(this);
                });
            };
        }

        // Create a File object.
        const blob = new Blob([''], { type: 'image/png' });
        file = new File([blob], 'test.png', { type: 'image/png' });
    });

    it('should render loading state initially', () => {
        render(<ImageMagickApp file={file} />);
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render the full UI after processing', async () => {
        render(<ImageMagickApp file={file} />);

        await waitFor(() => {
            expect(screen.getByText('Download')).toBeInTheDocument();
        });

        expect(screen.getByText('Open in Parent')).toBeInTheDocument();
        expect(screen.getByText(/Color Space:/)).toBeInTheDocument();
    });

    it('should call postMessage when "Open in Parent" is clicked', async () => {
        render(<ImageMagickApp file={file} />);

        await waitFor(() => {
            expect(screen.getByText('Open in Parent')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Open in Parent'));

        await waitFor(() => {
            expect(window.parent.postMessage).toHaveBeenCalled();
        });

        expect(window.parent.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'openFile',
                file: expect.any(File),
            }),
            '*'
        );
    });

    it('should render EXIF metadata if present', async () => {
        render(<ImageMagickApp file={file} />);

        await waitFor(() => {
            expect(screen.getByText(/Metadata/)).toBeInTheDocument();
        });

        expect(screen.getByText('EXIF')).toBeInTheDocument();
        expect(screen.getByText('Make')).toBeInTheDocument();
        expect(screen.getByText('MockMake')).toBeInTheDocument();
    });

    it('should detect and display Android Motion Photo metadata from XMP profile', async () => {
        const { ImageMagick } = await import('@imagemagick/magick-wasm');
        (ImageMagick.read as any).mockImplementationOnce((_buf: any, _settings: any, cb: any) => {
            const imageMock = {
                writeToCanvas: vi.fn(),
                write: vi.fn((_format, writeCb) => writeCb(new Uint8Array([1, 2, 3]))),
                attributeNames: [],
                getAttribute: vi.fn(() => null),
                getProfile: vi.fn((name) => {
                    if (name === 'xmp') {
                        return {
                            data: new TextEncoder().encode(`
                                <x:xmpmeta xmlns:x="adobe:ns:meta/">
                                    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
                                        <rdf:Description rdf:about="" 
                                            xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" 
                                            xmlns:Container="http://ns.google.com/photos/1.0/container/"
                                            xmlns:Item="http://ns.google.com/photos/1.0/container/item/"
                                            GCamera:MotionPhoto="1"
                                            GCamera:MotionPhotoVersion="1"
                                            GCamera:MotionPhotoPresentationTimestampUs="67890">
                                            <Container:Directory>
                                                <rdf:Seq>
                                                    <rdf:li rdf:parseType="Resource">
                                                        <Container:Item Item:Semantic="Primary" Item:Mime="image/jpeg" />
                                                    </rdf:li>
                                                    <rdf:li rdf:parseType="Resource">
                                                        <Container:Item Item:Length="12345" Item:Mime="video/mp4" Item:Semantic="MotionPhoto" />
                                                    </rdf:li>
                                                </rdf:Seq>
                                            </Container:Directory>
                                        </rdf:Description>
                                    </rdf:RDF>
                                </x:xmpmeta>
                            `)
                        };
                    }
                    return null;
                })
            };
            cb(imageMock);
            return new Uint8Array([1, 2, 3]);
        });

        render(<ImageMagickApp file={file} />);

        await waitFor(() => {
            expect(screen.getByText('Android Motion Photo')).toBeInTheDocument();
        });

        expect(screen.getByText(/Version:/)).toBeInTheDocument();
        expect(screen.getByText('1', { selector: 'div' })).toBeInTheDocument();
        expect(screen.getByText(/Timestamp:/)).toBeInTheDocument();
        expect(screen.getByText(/67890/)).toBeInTheDocument();
        expect(screen.getByText(/Video Offset:/)).toBeInTheDocument();
        expect(screen.getByText(/12345/)).toBeInTheDocument();
    });

    it('should open VideoModal when "Play Video" is clicked', async () => {
        global.URL.createObjectURL = vi.fn(() => 'blob:video-url');
        global.URL.revokeObjectURL = vi.fn();

        const { ImageMagick } = await import('@imagemagick/magick-wasm');
        (ImageMagick.read as any).mockImplementationOnce((_buf: any, _settings: any, cb: any) => {
            const imageMock = {
                writeToCanvas: vi.fn(),
                write: vi.fn((_format, writeCb) => writeCb(new Uint8Array([1, 2, 3]))),
                attributeNames: [],
                getAttribute: vi.fn(() => null),
                getProfile: vi.fn((name) => {
                    if (name === 'xmp') {
                        return {
                            data: new TextEncoder().encode(`
                                <x:xmpmeta xmlns:x="adobe:ns:meta/">
                                    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
                                        <rdf:Description 
                                            xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" 
                                            xmlns:Container="http://ns.google.com/photos/1.0/container/"
                                            xmlns:Item="http://ns.google.com/photos/1.0/container/item/"
                                            GCamera:MotionPhoto="1">
                                            <Container:Directory>
                                                <rdf:Seq>
                                                    <rdf:li rdf:parseType="Resource">
                                                        <Container:Item Item:Length="12345" Item:Mime="video/mp4" Item:Semantic="MotionPhoto" />
                                                    </rdf:li>
                                                </rdf:Seq>
                                            </Container:Directory>
                                        </rdf:Description>
                                    </rdf:RDF>
                                </x:xmpmeta>
                            `)
                        };
                    }
                    return null;
                })
            };
            cb(imageMock);
            return new Uint8Array([1, 2, 3]);
        });

        render(<ImageMagickApp file={file} />);

        await waitFor(() => {
            expect(screen.getByText('Play Video')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Play Video'));

        expect(screen.getByText('Motion Photo Video')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        const closeButton = screen.getByLabelText('Close');
        fireEvent.click(closeButton);

        expect(screen.queryByText('Motion Photo Video')).not.toBeInTheDocument();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:video-url');
    });
});
