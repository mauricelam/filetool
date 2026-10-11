// This worker handles decompression.
// It loads the compiled WebAssembly module, receives a file,
// decompresses it, and sends the result back to the main thread.

import init, { decode } from './decompressor-wasm/pkg/decompressor_wasm.js';
import { SparseImage } from '../img-viewer/sparse';

const decompressorModulePromise = (async () => {
    try {
        await init('decompressor_wasm_bg.wasm');
        self.postMessage({ type: 'ready' });
    } catch (e) {
        console.error('Failed to initialize WASM module', e);
        self.postMessage({ type: 'error', message: 'Failed to initialize WASM module: ' + e });
    }
})();

// Listen for messages from the main thread.
self.onmessage = async (event) => {
    try {
        await decompressorModulePromise;

        const { file } = event.data;
        if (!file) {
            return;
        }
        if (!(file instanceof File)) {
            self.postMessage({ type: 'error', message: 'Invalid file object received.' });
            return;
        }

        const compressedBuffer = await file.slice(0, 28).arrayBuffer();
        const compressedArray = new Uint8Array(compressedBuffer);

        // Check for Android Sparse Image magic 0xED26FF3A ([0x3a, 0xff, 0x26, 0xed])
        if (compressedArray.length >= 28 && compressedArray[0] === 0x3a && compressedArray[1] === 0xff && compressedArray[2] === 0x26 && compressedArray[3] === 0xed) {
            const sparse = await SparseImage.create(file);
            const unsparsedFile = sparse.toUnsparsedBlob(file.name);
            self.postMessage({
                type: 'done',
                file: unsparsedFile,
                format: 'Android Sparse'
            });
            return;
        }

        const fullBuffer = await file.arrayBuffer();
        const fullArray = new Uint8Array(fullBuffer);

        // Decompress using the generic WASM function
        const result = decode(fullArray);
        const decompressedArray = new Uint8Array(result.data);

        self.postMessage({
            type: 'done',
            data: decompressedArray.buffer,
            format: result.format
        }, [decompressedArray.buffer]);
    } catch (error) {
        console.error('Error processing input', error);
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        self.postMessage({ type: 'error', message: errorMessage });
    }
};
