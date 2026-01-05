
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


// Asynchronously instantiate the WebAssembly module.
createLzfseModule().then(Module => {
    lzfseModule = Module as LzfseModule;

    // Create a JavaScript wrapper for the C function.
    lzfse_decode_buffer = lzfseModule.cwrap(
        'lzfse_decode_buffer', 'number', ['number', 'number', 'number', 'number', 'number']
    );

    // Inform the main thread that the worker is ready.
    self.postMessage({ type: 'ready' });
});

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

        // Allocate memory in the WASM heap for the compressed data.
        const srcPtr = lzfseModule._malloc(compressedSize);
        if (srcPtr === 0) {
            throw new Error('Failed to allocate memory for compressed buffer.');
        }
        lzfseModule.HEAPU8.set(compressedArray, srcPtr);

        // First, call with a 0-sized output buffer to determine the required decompressed size.
        // The function returns the required size even on failure.
        const decompressedSize = lzfse_decode_buffer(0, 0, srcPtr, compressedSize, 0);
        if (decompressedSize === 0) {
            throw new Error('Failed to determine decompressed size. Input may not be a valid LZFSE stream.');
        }

        // Allocate memory for the decompressed data.
        const dstPtr = lzfseModule._malloc(decompressedSize);
        if (dstPtr === 0) {
            throw new Error('Failed to allocate memory for decompressed buffer.');
        }

        // Now, perform the actual decompression.
        const resultSize = lzfse_decode_buffer(dstPtr, decompressedSize, srcPtr, compressedSize, 0);
        if (resultSize !== decompressedSize) {
            throw new Error(`Decompression failed. Expected ${decompressedSize} bytes, but got ${resultSize}.`);
        }

        // Create a copy of the decompressed data from the WASM heap.
        const decompressedArray = new Uint8Array(lzfseModule.HEAPU8.buffer, dstPtr, decompressedSize).slice();

        // Free the allocated memory.
        lzfseModule._free(srcPtr);
        lzfseModule._free(dstPtr);

        // Send the decompressed data back to the main thread.
        // The ArrayBuffer is transferred, not copied, for performance.
        self.postMessage({ type: 'done', data: decompressedArray.buffer }, [decompressedArray.buffer]);

    } catch (error) {
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        self.postMessage({ type: 'error', message: errorMessage });
    }
};
