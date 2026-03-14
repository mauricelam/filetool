// @ts-ignore
importScripts('./wasm_exec.js');

let initialized = false;

self.onmessage = async (e) => {
    const { action, data, query } = e.data;

    if (!initialized) {
        // @ts-ignore
        const go = new self.Go();
        const result = await WebAssembly.instantiateStreaming(fetch('dextk.wasm'), go.importObject);
        go.run(result.instance);
        initialized = true;
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
