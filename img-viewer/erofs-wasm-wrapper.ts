// @ts-ignore
import createErofsModule from './erofs-wasm/dist/erofs.js';

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

export async function parse_erofs(data: Uint8Array): Promise<any> {
    const Module = await ensureErofsInitialized();
    const filename = `image_${Date.now()}_${Math.random().toString(36).substring(2)}.img`;
    const filepath = `/${filename}`;

    try {
        Module.FS.createDataFile('/', filename, data, true, true);
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

export async function read_erofs_file(data: Uint8Array, path: string): Promise<Uint8Array> {
    const Module = await ensureErofsInitialized();
    const filename = `image_${Date.now()}_${Math.random().toString(36).substring(2)}.img`;
    const filepath = `/${filename}`;

    try {
        Module.FS.createDataFile('/', filename, data, true, true);
        const erofsReadFileData = Module.cwrap('erofs_read_file_data', 'number', ['string', 'string', 'number']);
        const erofsFreeBuf = Module.cwrap('erofs_free_buf', null, ['number']);

        const outSizePtr = Module._malloc(4);
        const dataPtr = erofsReadFileData(filepath, path, outSizePtr);
        const size = Module.HEAP32[outSizePtr >> 2];
        Module._free(outSizePtr);

        if (!dataPtr && size > 0) {
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
