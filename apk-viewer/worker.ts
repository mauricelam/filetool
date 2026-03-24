import init, { decode_apk_minimal, extract_file, extract_arsc, ApkMetadata, ArscResource } from './wasm/pkg';

let wasmInitialized = false;
let systemResources: Uint8Array | null = null;
let apkBytes: Uint8Array | null = null;

async function initializeWasm() {
    if (!wasmInitialized) {
        await init();
        wasmInitialized = true;
    }
}

self.onmessage = async (e) => {
    const { action, payload } = e.data;

    try {
        switch (action) {
            case 'init':
                await initializeWasm();
                systemResources = payload.systemResources;
                self.postMessage({ action: 'init-complete' });
                break;

            case 'decode-minimal':
                apkBytes = payload.apkBytes;
                if (!systemResources) throw new Error("System resources not loaded");
                const minimalResponse = decode_apk_minimal(apkBytes!, systemResources);
                self.postMessage({
                    action: 'decode-minimal-complete',
                    payload: {
                        metadata: minimalResponse.metadata,
                        fileNames: minimalResponse.file_names
                    }
                });
                break;

            case 'extract-file':
                if (!apkBytes || !systemResources) throw new Error("WASM or APK not initialized");
                const fileContent = extract_file(apkBytes, payload.name, systemResources);
                self.postMessage({
                    action: 'extract-file-complete',
                    payload: {
                        name: payload.name,
                        content: fileContent
                    }
                }, { transfer: [fileContent.buffer] });
                break;

            case 'extract-arsc':
                if (!systemResources) throw new Error("System resources not loaded");
                const resources = extract_arsc(payload.arscBytes, systemResources);
                self.postMessage({
                    action: 'extract-arsc-complete',
                    payload: {
                        resources
                    }
                });
                break;
        }
    } catch (error) {
        self.postMessage({
            action: 'error',
            payload: { message: (error as Error).message }
        });
    }
};
