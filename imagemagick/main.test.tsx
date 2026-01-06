
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
                write: vi.fn((_format, writeCb) => writeCb(new Uint8Array([1, 2, 3])))
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
}));

vi.mock('@imagemagick/magick-wasm/magick.wasm', () => ({
    default: 'magick.wasm'
}));


describe('ImageMagickApp', () => {
    let file;

    beforeEach(() => {
        document.body.innerHTML = `<canvas id="canvas"></canvas>`;
        vi.clearAllMocks();
        window.parent.postMessage = vi.fn();

        // JSDOM's File object doesn't have arrayBuffer, so we need to add it.
        // This needs to be done before creating the File object.
        if (!Blob.prototype.arrayBuffer) {
            Blob.prototype.arrayBuffer = async function() {
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
});
