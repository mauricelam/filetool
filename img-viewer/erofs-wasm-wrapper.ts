// @ts-ignore
import createErofsModule from './erofs-wasm/dist/erofs.js';
import { SparseImage, SparseSubImage } from './sparse';

let erofsModulePromise: Promise<any> | null = null;

export async function ensureErofsInitialized(): Promise<any> {
    if (!erofsModulePromise) {
        erofsModulePromise = (async () => {
            try {
                return await createErofsModule({
                    locateFile: (path: string) => path
                });
            } catch (err) {
                erofsModulePromise = null;
                throw err;
            }
        })();
    }
    return erofsModulePromise;
}

function registerFileNode(Module: any, data: File | SparseImage | SparseSubImage): string {
    const filename = `image_${Date.now()}_${Math.random().toString(36).substring(2)}.img`;
    const filepath = `/${filename}`;

    Module.FS.createDataFile('/', filename, new Uint8Array(0), true, true);
    const lookup = Module.FS.lookupPath(filepath);
    const node = lookup.node;

    const isSparse = data instanceof SparseImage || data instanceof SparseSubImage;
    const size = isSparse ? data.unsparsedSize : (data as File).size;

    node.usedBytes = size;

    node.node_ops = {
        ...node.node_ops,
        getattr: (n: any) => ({
            dev: 1, ino: n.id, mode: n.mode, nlink: 1, uid: 0, gid: 0, rdev: 0,
            size: size, atime: new Date(n.atime), mtime: new Date(n.mtime), ctime: new Date(n.ctime),
            blksize: 4096, blocks: Math.ceil(size / 4096)
        })
    };

    const customStreamOps = {
        open: (stream: any) => {
            stream.stream_ops = customStreamOps;
        },
        close: () => {},
        read: (stream: any, buffer: Uint8Array, offset: number, length: number, position: number) => {
            if (position >= size) return 0;
            const bytesToRead = Math.min(size - position, length);

            if (isSparse) {
                const chunkData = (data as SparseImage | SparseSubImage).readSync(position, bytesToRead);
                buffer.set(chunkData, offset);
                return chunkData.length;
            }

            const file = data as File;
            if (typeof FileReaderSync !== 'undefined') {
                try {
                    const reader = new FileReaderSync();
                    const slice = file.slice(position, position + bytesToRead);
                    const ab = reader.readAsArrayBuffer(slice);
                    buffer.set(new Uint8Array(ab), offset);
                    return bytesToRead;
                } catch (err) {
                    console.error("FileReaderSync failed:", err);
                }
            }

            // Chunked XHR read for main thread context
            let readSoFar = 0;
            const CHUNK_SIZE = 64 * 1024; // 64KB chunks to avoid string allocation limits
            while (readSoFar < bytesToRead) {
                const chunkBytes = Math.min(bytesToRead - readSoFar, CHUNK_SIZE);
                const chunkSlice = file.slice(position + readSoFar, position + readSoFar + chunkBytes);
                const blobUrl = URL.createObjectURL(chunkSlice);
                const xhr = new XMLHttpRequest();
                xhr.open('GET', blobUrl, false);
                xhr.overrideMimeType('text/plain; charset=x-user-defined');
                xhr.send(null);
                URL.revokeObjectURL(blobUrl);

                if (xhr.status === 200 || xhr.status === 0) {
                    const text = xhr.responseText;
                    const len = Math.min(chunkBytes, text.length);
                    for (let i = 0; i < len; i++) {
                        buffer[offset + readSoFar + i] = text.charCodeAt(i) & 0xff;
                    }
                    readSoFar += len;
                    if (len === 0) break;
                } else {
                    console.error(`[stream_ops.read] XHR failed with status ${xhr.status} for position ${position + readSoFar}`);
                    break;
                }
            }
            return readSoFar;
        },
        llseek: (stream: any, offset: number, whence: number) => {
            let position = offset;
            if (whence === 1) position += stream.position;
            else if (whence === 2) position += size;
            if (position < 0) throw new Module.FS.ErrnoError(28);
            stream.position = position;
            return position;
        }
    };
    node.stream_ops = customStreamOps;

    return filepath;
}

export async function parse_erofs(data: Uint8Array | File | SparseImage | SparseSubImage): Promise<any> {
    const Module = await ensureErofsInitialized();
    let filepath: string;

    if (data instanceof File || data instanceof SparseImage || data instanceof SparseSubImage) {
        filepath = registerFileNode(Module, data);
    } else {
        const filename = `image_${Date.now()}_${Math.random().toString(36).substring(2)}.img`;
        filepath = `/${filename}`;
        Module.FS.createDataFile('/', filename, data, true, true);
    }

    try {
        const erofsParseTree = Module.cwrap('erofs_parse_tree', 'string', ['string']);
        const treeJson = erofsParseTree(filepath);
        if (!treeJson) {
            throw new Error('Failed to parse EROFS superblock or directory tree');
        }
        return JSON.parse(treeJson);
    } finally {
        try {
            Module.FS.unlink(filepath);
        } catch (e) {
            // ignore cleanup errors
        }
    }
}

export async function read_erofs_file(data: Uint8Array | File | SparseImage | SparseSubImage, path: string): Promise<Uint8Array> {
    const Module = await ensureErofsInitialized();
    let filepath: string;

    if (data instanceof File || data instanceof SparseImage || data instanceof SparseSubImage) {
        filepath = registerFileNode(Module, data);
    } else {
        const filename = `image_${Date.now()}_${Math.random().toString(36).substring(2)}.img`;
        filepath = `/${filename}`;
        Module.FS.createDataFile('/', filename, data, true, true);
    }

    try {
        const erofsReadFileData = Module.cwrap('erofs_read_file_data', 'number', ['string', 'string', 'number']);
        const erofsFreeBuf = Module.cwrap('erofs_free_buf', null, ['number']);

        const outSizePtr = Module._malloc(4);
        Module.HEAP32[outSizePtr >> 2] = 0;
        const dataPtr = erofsReadFileData(filepath, path, outSizePtr);
        const size = Module.HEAP32[outSizePtr >> 2];
        Module._free(outSizePtr);

        if (!dataPtr) {
            console.error(`[read_erofs_file] erofs_read_file_data returned NULL for path="${path}", size=${size}`);
            throw new Error(`Failed to read EROFS file at path ${path}`);
        }

        const result = new Uint8Array(size);
        if (size > 0 && dataPtr) {
            result.set(Module.HEAPU8.subarray(dataPtr, dataPtr + size));
            erofsFreeBuf(dataPtr);
        }
        return result;
    } finally {
        try {
            Module.FS.unlink(filepath);
        } catch (e) {
            // ignore cleanup errors
        }
    }
}
