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

export async function parse_erofs_file(file: File): Promise<any> {
    const Module = await ensureErofsInitialized();
    const folder = `dir_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const folderPath = `/${folder}`;
    const filePath = `${folderPath}/${file.name}`;

    try {
        if (Module.WORKERFS) {
            Module.FS.mkdir(folderPath);
            Module.FS.mount(Module.WORKERFS, { files: [file] }, folderPath);
        } else {
            const buffer = await file.arrayBuffer();
            Module.FS.createDataFile('/', file.name, new Uint8Array(buffer), true, true);
        }

        const targetPath = Module.WORKERFS ? filePath : `/${file.name}`;
        const erofsParseTree = Module.cwrap('erofs_parse_tree', 'string', ['string']);
        const treeJson = erofsParseTree(targetPath);
        if (!treeJson) {
            throw new Error('Failed to parse EROFS superblock or directory tree');
        }
        return JSON.parse(treeJson);
    } finally {
        try {
            if (Module.WORKERFS) {
                Module.FS.unmount(folderPath);
                Module.FS.rmdir(folderPath);
            } else {
                Module.FS.unlink(`/${file.name}`);
            }
        } catch (e) {
            // ignore cleanup errors
        }
    }
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

export async function read_erofs_file_from_blob(file: File, path: string): Promise<Uint8Array> {
    const Module = await ensureErofsInitialized();
    const folder = `dir_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const folderPath = `/${folder}`;
    const filePath = `${folderPath}/${file.name}`;

    try {
        if (Module.WORKERFS) {
            Module.FS.mkdir(folderPath);
            Module.FS.mount(Module.WORKERFS, { files: [file] }, folderPath);
        } else {
            const buffer = await file.arrayBuffer();
            Module.FS.createDataFile('/', file.name, new Uint8Array(buffer), true, true);
        }

        const targetPath = Module.WORKERFS ? filePath : `/${file.name}`;
        const erofsReadFileData = Module.cwrap('erofs_read_file_data', 'number', ['string', 'string', 'number']);
        const erofsFreeBuf = Module.cwrap('erofs_free_buf', null, ['number']);

        const outSizePtr = Module._malloc(4);
        const dataPtr = erofsReadFileData(targetPath, path, outSizePtr);
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
            if (Module.WORKERFS) {
                Module.FS.unmount(folderPath);
                Module.FS.rmdir(folderPath);
            } else {
                Module.FS.unlink(`/${file.name}`);
            }
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
