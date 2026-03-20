
import init, { list_entries, extract_entry, create_zip, create_tar_gz } from './archive-wasm/pkg/archive_wasm.js';

const archiveModulePromise = (async () => {
    try {
        await init('archive_wasm_bg.wasm');
        self.postMessage({ type: 'ready' });
    } catch (e) {
        console.error('Failed to initialize WASM module', e);
        self.postMessage({ type: 'error', message: 'Failed to initialize WASM module: ' + e });
    }
})();

self.onmessage = async (event) => {
    try {
        await archiveModulePromise;

        const { action, data, entryName, files, id } = event.data;

        if (action === 'list') {
            const metadata = list_entries(new Uint8Array(data));
            self.postMessage({ type: 'list_done', metadata, id });
        } else if (action === 'extract') {
            const result = extract_entry(new Uint8Array(data), entryName);
            self.postMessage({ type: 'extract_done', data: result.buffer, entryName, id }, [result.buffer]);
        } else if (action === 'create_zip') {
            const result = create_zip(files);
            self.postMessage({ type: 'create_done', data: result.buffer, id }, [result.buffer]);
        } else if (action === 'create_tar_gz') {
            const result = create_tar_gz(files);
            self.postMessage({ type: 'create_done', data: result.buffer, id }, [result.buffer]);
        }
    } catch (error) {
        console.error('Error processing message', error);
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        self.postMessage({ type: 'error', message: errorMessage, id: event.data.id });
    }
};
