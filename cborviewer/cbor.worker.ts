import * as wasm from './cbor-diag-wasm/cbor_diag_wasm.js';

self.onmessage = async (e: MessageEvent) => {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            try {
                // The wasm module is initialized on import, so we just signal success.
                self.postMessage({ type: 'init', success: true });
            } catch (err) {
                self.postMessage({ type: 'init', success: false, error: err.message });
            }
            break;

        case 'process':
            if (!data) {
                return
            }
            try {
                const result = wasm.to_diag(data);
                self.postMessage({ type: 'process', result });
            } catch (err) {
                self.postMessage({ type: 'process', error: err.message });
            }
            break;
    }
};