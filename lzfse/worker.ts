
// This worker handles LZFSE decompression.
// It loads the compiled WebAssembly module, receives a file,
// decompresses it, and sends the result back to the main thread.

import init, { decode } from './lzfse-wasm/pkg/lzfse_wasm.js';

const lzfseModulePromise = (async () => {
    await init('lzfse_wasm_bg.wasm');
    self.postMessage({ type: 'ready' });
})();

// Listen for messages from the main thread.
self.onmessage = async (event) => {
    await lzfseModulePromise;

    const { file } = event.data;
    if (!(file instanceof File)) {
        self.postMessage({ type: 'error', message: 'Invalid file object received.' });
        return;
    }

    try {
        const compressedBuffer = await file.arrayBuffer();
        const compressedArray = new Uint8Array(compressedBuffer);

        // Decompress using the new Rust-based WASM function
        const decompressedArray = decode(compressedArray);

        // Send the decompressed data back to the main thread.
        // The ArrayBuffer is transferred, not copied, for performance.
        self.postMessage({ type: 'done', data: decompressedArray.buffer }, [decompressedArray.buffer]);
    } catch (error) {
        console.error('Error processing input', error)
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        self.postMessage({ type: 'error', message: errorMessage });
    }
};
