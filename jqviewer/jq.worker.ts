import * as jqWasm from 'jq-wasm';

// Initialize jq-wasm
let jq: typeof jqWasm | null = null;

// Handle messages from the main thread
self.onmessage = async (e: MessageEvent) => {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            try {
                jq = await jqWasm;
                self.postMessage({ type: 'init', success: true });
            } catch (err) {
                self.postMessage({ type: 'init', success: false, error: err.message });
            }
            break;

        case 'process':
            if (!jq) {
                self.postMessage({ type: 'process', error: 'jq-wasm not initialized' });
                return;
            }

            try {
                const { input, filter } = data;
                const result = await jq.json(input, filter);
                self.postMessage({ type: 'process', result });
            } catch (err) {
                self.postMessage({ type: 'process', error: err.message });
            }
            break;

        case 'version':
            if (!jq) {
                self.postMessage({ type: 'version', error: 'jq-wasm not initialized' });
                return;
            }

            try {
                const version = await jq.version();
                self.postMessage({ type: 'version', version });
            } catch (err) {
                self.postMessage({ type: 'version', error: err.message });
            }
            break;
    }
}; 