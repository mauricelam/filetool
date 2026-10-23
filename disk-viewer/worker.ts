import init, { DiskSession } from './disk-wasm/pkg';

class WorkerFileBackend {
    file: File;
    readerSync: FileReaderSync;

    constructor(file: File) {
        this.file = file;
        this.readerSync = new FileReaderSync();
    }

    get size(): number {
        return this.file.size;
    }

    readAt(offset: number, length: number): Uint8Array {
        const slice = this.file.slice(offset, offset + length);
        const buffer = this.readerSync.readAsArrayBuffer(slice);
        return new Uint8Array(buffer);
    }
}

let session: DiskSession | null = null;

self.onmessage = async (e: MessageEvent) => {
    const data = e.data;
    const { id, type } = data;

    try {
        if (type === 'init') {
            await init();
            const file = data.file as File;
            const backend = new WorkerFileBackend(file);
            session = new DiskSession(backend as any);
            const diskInfo = session.inspect();
            self.postMessage({ type: 'init_ok', diskInfo });
            return;
        }

        if (!session) {
            throw new Error("DiskSession not initialized");
        }

        if (type === 'list_dir') {
            const { partitionIndex, isPartitioned, path } = data;
            const entries = session.list_dir(partitionIndex, isPartitioned, path);
            self.postMessage({ id, type: 'list_dir_ok', entries });
            return;
        }

        if (type === 'read_file_range') {
            const { partitionIndex, isPartitioned, path, offset, length } = data;
            const bytes = session.read_file_range(partitionIndex, isPartitioned, path, offset, length);
            self.postMessage({ id, type: 'read_file_range_ok', bytes }, [bytes.buffer]);
            return;
        }

        throw new Error(`Unknown message type: ${type}`);
    } catch (err: any) {
        const errorMessage = err?.message || String(err);
        if (id !== undefined) {
            self.postMessage({ id, type: 'error', error: errorMessage });
        } else {
            self.postMessage({ type: 'init_error', error: errorMessage });
        }
    }
};
