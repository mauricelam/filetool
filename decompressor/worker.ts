
import init, { decode } from './decompressor-wasm/pkg/decompressor_wasm.js';

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
            // Ignore empty messages
            return;
        }
        if (!(file instanceof File)) {
            self.postMessage({ type: 'error', message: 'Invalid file object received.' });
            return;
        }

        const compressedBuffer = await file.arrayBuffer();
        const compressedArray = new Uint8Array(compressedBuffer);

        // Decompress using the generic WASM function
        const result = decode(compressedArray);
        const decompressedArray = new Uint8Array(result.data);

        // Send the decompressed data back to the main thread.
        // The ArrayBuffer is transferred, not copied, for performance.
        self.postMessage({
            type: 'done',
            data: decompressedArray.buffer,
            format: result.format
        }, [decompressedArray.buffer]);
    } catch (error) {
        console.error('Error processing input', error)
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        self.postMessage({ type: 'error', message: errorMessage });
    }
};
