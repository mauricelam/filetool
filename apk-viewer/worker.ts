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
    console.log(`Worker: Received action "${action}"`);

    try {
        switch (action) {
            case 'init':
                console.log('Worker: Initializing WASM...');
                await initializeWasm();
                systemResources = payload.systemResources;
                console.log('Worker: WASM initialized, system resources set');
                self.postMessage({ action: 'init-complete' });
                break;

            case 'decode-minimal':
                apkBytes = payload.apkBytes;
                console.log(`Worker: Decoding APK minimal (${apkBytes?.length} bytes)...`);
                if (!systemResources) throw new Error("System resources not loaded");
                const minimalResponse = decode_apk_minimal(apkBytes!, systemResources);
                console.log(`Worker: Minimal decoding complete. Found ${minimalResponse.file_names.length} files.`);
                self.postMessage({
                    action: 'decode-minimal-complete',
                    payload: {
                        metadata: minimalResponse.metadata,
                        fileNames: minimalResponse.file_names
                    }
                });
                break;

            case 'extract-file':
                console.log(`Worker: Extracting file "${payload.name}"...`);
                if (!apkBytes || !systemResources) throw new Error("WASM or APK not initialized");
                const fileContent = extract_file(apkBytes, payload.name, systemResources);
                console.log(`Worker: File "${payload.name}" extracted (${fileContent.length} bytes)`);
                self.postMessage({
                    action: 'extract-file-complete',
                    payload: {
                        name: payload.name,
                        content: fileContent
                    }
                }, { transfer: [fileContent.buffer] });
                break;

            case 'extract-arsc':
                console.log(`Worker: Extracting ARSC resources (${payload.arscBytes.length} bytes)...`);
                if (!systemResources) throw new Error("System resources not loaded");
                const resources = extract_arsc(payload.arscBytes, systemResources);
                console.log(`Worker: Extracted ${resources.length} ARSC resources`);
                self.postMessage({
                    action: 'extract-arsc-complete',
                    payload: {
                        resources
                    }
                });
                break;
        }
    } catch (error) {
        console.error(`Worker: Error during action "${action}":`, error);
        self.postMessage({
            action: 'error',
            payload: { message: (error as Error).message }
        });
    }
};
