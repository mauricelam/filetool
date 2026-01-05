
// This worker handles LZFSE decompression.
// It loads the compiled WebAssembly module, receives a file,
// decompresses it, and sends the result back to the main thread.

import createLzfseModule from './lzfse.js';

// Define the shape of the WASM module once it's loaded.
interface LzfseModule {
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAPU8: Uint8Array;
    cwrap(
        name: string,
        returnType: string,
        argTypes: string[]
    ): (...args: any[]) => any;
}

let lzfseModule: LzfseModule | undefined;
let lzfse_decode_buffer: (
    dst_buffer: number,
    dst_size: number,
    src_buffer: number,
    src_size: number,
    scratch_buffer: number
) => number;

async function init() {
    lzfseModule = await createLzfseModule() as LzfseModule;

    // Create a JavaScript wrapper for the C function.
    lzfse_decode_buffer = lzfseModule.cwrap(
        'lzfse_decode_buffer', 'number', ['number', 'number', 'number', 'number', 'number']
    );

    // Inform the main thread that the worker is ready.
    self.postMessage({ type: 'ready' });
}

init()

// Listen for messages from the main thread.
self.onmessage = async (event) => {
    if (!lzfseModule || !lzfse_decode_buffer) {
        self.postMessage({ type: 'error', message: 'LZFSE module not yet initialized.' });
        return;
    }

    const { file } = event.data;
    if (!(file instanceof File)) {
        self.postMessage({ type: 'error', message: 'Invalid file object received.' });
        return;
    }

    try {
        const compressedBuffer = await file.arrayBuffer();
        const compressedArray = new Uint8Array(compressedBuffer);
        const compressedSize = compressedArray.length;

        // 1. Allocate Source
        const srcPtr = lzfseModule._malloc(compressedSize);
        lzfseModule.HEAPU8.set(compressedArray, srcPtr);

        // 2. Heuristic for Destination Size
        // Since we don't know the size, let's start with a large multiplier (e.g., 5x)
        // or use a fixed large limit if you know the max file size.
        let estimatedSize = compressedSize * 4;
        let dstPtr = lzfseModule._malloc(estimatedSize);

        // 3. Decompress
        let resultSize = lzfse_decode_buffer(dstPtr, estimatedSize, srcPtr, compressedSize, 0);

        // 4. If result is 0, the buffer was too small. Try one more time with a much larger buffer.
        if (resultSize === 0) {
            lzfseModule._free(dstPtr);
            estimatedSize = compressedSize * 12; // Aggressive expansion
            dstPtr = lzfseModule._malloc(estimatedSize);
            resultSize = lzfse_decode_buffer(dstPtr, estimatedSize, srcPtr, compressedSize, 0);
        }

        if (resultSize === 0) {
            throw new Error('Decompression failed. Buffer too small or invalid LZFSE data.');
        }

        // Create the result from the actual resultSize, not the estimatedSize
        const decompressedArray = new Uint8Array(lzfseModule.HEAPU8.buffer, dstPtr, resultSize).slice();

        lzfseModule._free(srcPtr);
        lzfseModule._free(dstPtr);

        // Send the decompressed data back to the main thread.
        // The ArrayBuffer is transferred, not copied, for performance.
        self.postMessage({ type: 'done', data: decompressedArray.buffer }, [decompressedArray.buffer]);
    } catch (error) {
        console.error('Error processing input', error)
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        self.postMessage({ type: 'error', message: errorMessage });
    }
};
