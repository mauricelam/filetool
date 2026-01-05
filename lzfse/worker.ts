
// This worker handles LZFSE decompression.
// It loads the compiled WebAssembly module, receives a file,
// decompresses it, and sends the result back to the main thread.

import createLzfseModule, { MainModule } from 'lzfse-wasm';

class LzfseModuleWrapper {
    constructor(public module: MainModule, public decodeBuffer: (
        dst_buffer: number,
        dst_size: number,
        src_buffer: number,
        src_size: number,
        scratch_buffer: number
    ) => number) { }

    static async init(): Promise<LzfseModuleWrapper> {
        const lzfseModule = await createLzfseModule();
        self.postMessage({ type: 'ready' });
        return new LzfseModuleWrapper(lzfseModule, lzfseModule.cwrap(
            'lzfse_decode_buffer', 'number', ['number', 'number', 'number', 'number', 'number']
        ));
    }
}

const lzfseModulePromise = LzfseModuleWrapper.init();

// Listen for messages from the main thread.
self.onmessage = async (event) => {
    const lzfseModule = await lzfseModulePromise;
    if (!lzfseModule.decodeBuffer) {
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
        const srcPtr = lzfseModule.module._malloc(compressedSize);
        lzfseModule.module.HEAPU8.set(compressedArray, srcPtr);

        // 2. Heuristic for Destination Size
        // Since we don't know the size, let's start with a large multiplier (e.g., 5x)
        // or use a fixed large limit if you know the max file size.
        let estimatedSize = compressedSize * 4;
        let dstPtr = lzfseModule.module._malloc(estimatedSize);

        // 3. Decompress
        let resultSize = lzfseModule.decodeBuffer(dstPtr, estimatedSize, srcPtr, compressedSize, 0);

        // 4. If result is 0, the buffer was too small. Try one more time with a much larger buffer.
        if (resultSize === 0) {
            lzfseModule.module._free(dstPtr);
            estimatedSize = compressedSize * 12; // Aggressive expansion
            dstPtr = lzfseModule.module._malloc(estimatedSize);
            resultSize = lzfseModule.decodeBuffer(dstPtr, estimatedSize, srcPtr, compressedSize, 0);
        }

        if (resultSize === 0) {
            throw new Error('Decompression failed. Buffer too small or invalid LZFSE data.');
        }

        // Create the result from the actual resultSize, not the estimatedSize
        const decompressedArray = new Uint8Array(lzfseModule.module.HEAPU8.buffer, dstPtr, resultSize).slice();

        lzfseModule.module._free(srcPtr);
        lzfseModule.module._free(dstPtr);

        // Send the decompressed data back to the main thread.
        // The ArrayBuffer is transferred, not copied, for performance.
        self.postMessage({ type: 'done', data: decompressedArray.buffer }, [decompressedArray.buffer]);
    } catch (error) {
        console.error('Error processing input', error)
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        self.postMessage({ type: 'error', message: errorMessage });
    }
};
