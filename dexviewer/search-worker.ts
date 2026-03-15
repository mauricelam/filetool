/**
 * Search worker for DEX API usages
 * Offloads heavy instruction scanning to a background thread
 */

// @ts-ignore
try {
    importScripts('./wasm_exec.js');
} catch (e) {
    console.error('[search-worker] Failed to import wasm_exec.js:', e);
}

let wasmPromise: Promise<void> | null = null;

async function initWasm() {
    if (wasmPromise) return wasmPromise;

    wasmPromise = (async () => {
        try {
            console.log('[search-worker] Initializing Go WASM...');
            // @ts-ignore
            if (!self.Go) {
                throw new Error('Go constructor not found. wasm_exec.js might have failed to load.');
            }
            // @ts-ignore
            const go = new self.Go();
            const response = await fetch('dextk.wasm');
            if (!response.ok) {
                throw new Error(`Failed to fetch dextk.wasm: ${response.status} ${response.statusText}`);
            }
            const result = await WebAssembly.instantiateStreaming(response, go.importObject);
            go.run(result.instance);
            console.log('[search-worker] Go WASM initialized successfully.');
        } catch (e) {
            console.error('[search-worker] Failed to initialize Go WASM:', e);
            wasmPromise = null; // Allow retry
            throw e;
        }
    })();

    return wasmPromise;
}

self.onmessage = async (e) => {
    const { action, data, query } = e.data;

    try {
        await initWasm();
    } catch (e) {
        self.postMessage({ action, error: 'WASM initialization failed' });
        return;
    }

    // @ts-ignore
    const godexviewer = self.godexviewer;

    if (action === 'setFileData') {
        if (godexviewer?.setFileData) {
            godexviewer.setFileData(data);
        }
        self.postMessage({ action: 'setFileData', status: 'ok' });
    } else if (action === 'searchUsages') {
        if (godexviewer?.searchUsages) {
            const results = godexviewer.searchUsages(query);
            self.postMessage({ action: 'searchUsages', results });
        } else {
            self.postMessage({ action: 'searchUsages', results: [] });
        }
    }
};
