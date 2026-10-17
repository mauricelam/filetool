import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import init, { parse_ext4, parse_ext4_stream, read_ext4_file, read_ext4_file_stream } from './ext4-wasm/pkg';
import { parse_erofs, read_erofs_file, ensureErofsInitialized } from './erofs-wasm-wrapper';
import { SparseImage, SparseSubImage } from './sparse';
import { LpMetadata } from './lpmeta';
import { ColumnView } from '../components/ColumnView';

let ext4InitPromise: Promise<void> | null = null;

function ensureExt4Initialized(): Promise<void> {
    if (!ext4InitPromise) {
        ext4InitPromise = (async () => {
            try {
                await init();
            } catch (err) {
                ext4InitPromise = null;
                throw err;
            }
        })();
    }
    return ext4InitPromise;
}

function ensureWasmInitialized(): Promise<void> {
    return Promise.all([ensureExt4Initialized(), ensureErofsInitialized()]).then(() => {});
}

const guessImageType = (data: Uint8Array): string | null => {
    const checkString = (offset: number, str: string) => {
        if (data.length < offset + str.length) return false;
        for (let i = 0; i < str.length; i++) {
            if (data[offset + i] !== str.charCodeAt(i)) return false;
        }
        return true;
    };

    if (checkString(0x3, "NTFS    ")) return "NTFS";
    if (checkString(0x3, "EXFAT   ")) return "exFAT";
    if (checkString(0x52, "FAT32   ")) return "FAT32";
    if (checkString(0x36, "FAT12   ")) return "FAT12";
    if (checkString(0x36, "FAT16   ")) return "FAT16";
    if (checkString(0x0, "XFSB")) return "XFS";
    if (checkString(0x20, "NXSB") || checkString(0x0, "NXSB") || checkString(0x8, "NXSB")) return "APFS";
    if (checkString(0x8001, "CD001")) return "ISO9660";
    if (checkString(0x10040, "_BHRfS_M")) return "Btrfs";
    if (data.length > 0x400 + 4 && data[0x400] === 0x10 && data[0x401] === 0x20 && data[0x402] === 0xF5 && data[0x403] === 0xF2) return "F2FS";
    if (checkString(0x400, "H+") || checkString(0x400, "HX")) return "HFS+";
    if (checkString(0x0, "hsqs")) return "SquashFS";
    if (checkString(0x1FE, "\x55\xAA")) return "MBR/FAT";
    if (checkString(512, "EFI PART")) return "GPT";

    return null;
};

/**
 * Recursively prefixes file paths in a partition's directory tree node with the partition name.
 *
 * When a filesystem image (ext4 or EROFS) inside an Android super.img partition is parsed,
 * its file nodes initially have paths relative to the partition root (e.g., "/hello.txt").
 * This helper prefixes each node's `_path` with the partition name route (e.g., "/system_a/hello.txt")
 * so that `findSubImageForPath` can extract the partition name and route extraction requests
 * to the partition's `SparseSubImage` rather than reading directly from `super.img`.
 *
 * @param node The directory or file tree node to update.
 * @param prefix The partition route prefix (e.g., "/system_a").
 */
function fixPartitionPaths(node: any, prefix: string) {
    if (!node || typeof node !== 'object' || node instanceof Uint8Array) return;

    if (typeof node._path === 'string') {
        if (node._path === '/' || node._path === '') {
            node._path = prefix;
        } else if (node._path.startsWith('/')) {
            node._path = `${prefix}${node._path}`;
        } else {
            node._path = `${prefix}/${node._path}`;
        }
    }

    for (const key of Object.keys(node)) {
        if (!key.startsWith('_')) {
            fixPartitionPaths(node[key], prefix);
        }
    }
}

const makeReadFn = (file: File) => {
    return (offset: number, length: number): Uint8Array => {
        if (typeof FileReaderSync !== 'undefined') {
            const syncReader = new FileReaderSync();
            const slice = file.slice(offset, offset + length);
            const buf = syncReader.readAsArrayBuffer(slice);
            return new Uint8Array(buf);
        } else {
            const blobUrl = URL.createObjectURL(file.slice(offset, offset + length));
            const xhr = new XMLHttpRequest();
            xhr.open('GET', blobUrl, false);
            xhr.overrideMimeType('text/plain; charset=x-user-defined');
            xhr.send(null);
            URL.revokeObjectURL(blobUrl);

            const out = new Uint8Array(length);
            if (xhr.status === 200 || xhr.status === 0) {
                const text = xhr.responseText;
                const len = Math.min(out.length, text.length);
                for (let i = 0; i < len; i++) {
                    out[i] = text.charCodeAt(i) & 0xff;
                }
            }
            return out;
        }
    };
};

const ImgViewer: React.FC = () => {
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [fsType, setFsType] = useState<string | null>(null);
    const [subImageMap, setSubImageMap] = useState<Record<string, { sub: SparseSubImage, isErofs: boolean }>>({});
    const [tree, setTree] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        ensureWasmInitialized().then(() => {
            if (window.parent) {
                window.parent.postMessage({ action: 'requestFile' });
            }
        }).catch(err => setError(`Failed to initialize WASM: ${err}`));

        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                await ensureWasmInitialized();
                let file = e.data.file as File;

                let headerBuf: ArrayBuffer;
                try {
                    headerBuf = await file.slice(0, 65536).arrayBuffer();
                } catch (err) {
                    console.error("Failed to read file header:", err);
                    setError(`Failed to read file header: ${err}`);
                    return;
                }
                let headerData = new Uint8Array(headerBuf);

                if (SparseImage.isSparseHeader(headerData)) {
                    try {
                        const parsedSparse = await SparseImage.create(file);
                        file = parsedSparse.toUnsparsedBlob(file.name);
                        headerBuf = await file.slice(0, 65536).arrayBuffer();
                        headerData = new Uint8Array(headerBuf);
                    } catch (err) {
                        console.error("Failed to parse sparse image:", err);
                        setError(`Failed to parse Android sparse image header: ${err}`);
                        return;
                    }
                }

                setSourceFile(file);

                const readSync = makeReadFn(file);
                const firstMb = readSync(0, 131072);

                if (LpMetadata.isLpMetadata(firstMb)) {
                    setFsType('super.img');
                    try {
                        setLoading(true);
                        const partitions = LpMetadata.parsePartitions(firstMb);
                        const rootTree: Record<string, any> = {};
                        const subMap: Record<string, { sub: SparseSubImage, isErofs: boolean }> = {};

                        for (const p of partitions) {
                            const sub = new SparseSubImage(file, p.extents);
                            const pHeader = sub.readSync(0, 65536);

                            const isExt4 = pHeader.length > 1081 && pHeader[1080] === 0x53 && pHeader[1081] === 0xEF;
                            const isErofs = pHeader.length > 0x400 + 4 && pHeader[0x400] === 0xE2 && pHeader[0x401] === 0xE1 && pHeader[0x402] === 0xF5 && pHeader[0x403] === 0xE0;

                            subMap[p.name] = { sub, isErofs };

                            if (isExt4) {
                                await ensureExt4Initialized();
                                const pTree = parse_ext4_stream(BigInt(p.sizeBytes), (off, len) => sub.readSync(off, len));
                                fixPartitionPaths(pTree, `/${p.name}`);
                                pTree._size = p.sizeBytes;
                                pTree._path = `/${p.name}`;
                                pTree._mode = 0o644;
                                pTree._uid = 0;
                                pTree._gid = 0;
                                rootTree[p.name] = pTree;
                            } else if (isErofs) {
                                await ensureErofsInitialized();
                                const pTree = await parse_erofs(sub);
                                fixPartitionPaths(pTree, `/${p.name}`);
                                pTree._size = p.sizeBytes;
                                pTree._path = `/${p.name}`;
                                pTree._mode = 0o644;
                                pTree._uid = 0;
                                pTree._gid = 0;
                                rootTree[p.name] = pTree;
                            } else {
                                rootTree[p.name] = {
                                    _size: p.sizeBytes,
                                    _path: `/${p.name}`,
                                    _mode: 0o644,
                                    _uid: 0,
                                    _gid: 0
                                };
                            }
                        }

                        setSubImageMap(subMap);
                        setTree(rootTree);
                    } catch (err) {
                        setError(`Failed to parse Android super.img logical partitions: ${err}`);
                        console.error(err);
                    } finally {
                        setLoading(false);
                    }
                    return;
                }

                // ext4 magic number 0xEF53 at offset 1080 (0x438)
                const isExt4 = headerData.length > 1081 && headerData[1080] === 0x53 && headerData[1081] === 0xEF;
                // EROFS magic number 0xE0F5E1E2 at offset 0x400
                const isErofs = headerData.length > 0x400 + 4 && headerData[0x400] === 0xE2 && headerData[0x401] === 0xE1 && headerData[0x402] === 0xF5 && headerData[0x403] === 0xE0;

                if (isExt4) {
                    setFsType('ext4');
                    try {
                        setLoading(true);
                        await ensureExt4Initialized();
                        const unsparsedSize = BigInt(file.size);
                        const readFn = makeReadFn(file);
                        const parsedTree = parse_ext4_stream(unsparsedSize, readFn);
                        setTree(parsedTree);
                    } catch (err) {
                        setError(`Failed to parse ext4: ${err}`);
                        console.error(err);
                    } finally {
                        setLoading(false);
                    }
                } else if (isErofs) {
                    setFsType('erofs');
                    try {
                        setLoading(true);
                        await ensureErofsInitialized();
                        const parsedTree = await parse_erofs(file);
                        setTree(parsedTree);
                    } catch (err) {
                        setError(`Failed to parse EROFS: ${err}`);
                        console.error(err);
                    } finally {
                        setLoading(false);
                    }
                } else {
                    const guessedType = guessImageType(headerData);
                    if (guessedType) {
                        setError(`.img file with type ${guessedType} is not supported yet. Try an ext4 or EROFS formatted img file instead`);
                    } else {
                        setError("This file does not appear to be a valid ext4 or EROFS filesystem image.");
                    }
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const findSubImageForPath = (filePath: string) => {
        const parts = filePath.split('/').filter(Boolean);
        if (parts.length > 0) {
            const partitionName = parts[0];
            if (subImageMap[partitionName]) {
                const subObj = subImageMap[partitionName];
                const relPath = '/' + parts.slice(1).join('/');
                return { sub: subObj.sub, isErofs: subObj.isErofs, relPath, partitionName };
            }
        }
        return null;
    };

    const handleDownload = async (file: any, name: string) => {
        if (!sourceFile) return;
        setActionError(null);
        try {
            let blob: Blob;
            const subInfo = findSubImageForPath(file._path);

            if (subInfo) {
                if (subInfo.relPath === '/' || subInfo.relPath === '') {
                    // Extracting/Downloading the partition raw .img file itself
                    const partitionFileName = name.endsWith('.img') ? name : `${name}.img`;
                    blob = subInfo.sub.toBlob(partitionFileName);
                } else if (subInfo.isErofs) {
                    await ensureErofsInitialized();
                    const content = await read_erofs_file(subInfo.sub, subInfo.relPath);
                    blob = new Blob([content]);
                } else {
                    await ensureExt4Initialized();
                    const unsparsedSize = BigInt(subInfo.sub.unsparsedSize);
                    const readFn = (off: number, len: number) => subInfo.sub.readSync(off, len);
                    const content = read_ext4_file_stream(unsparsedSize, readFn, subInfo.relPath);
                    blob = new Blob([content]);
                }
            } else if (fsType === 'erofs') {
                await ensureErofsInitialized();
                const content = await read_erofs_file(sourceFile, file._path);
                blob = new Blob([content]);
            } else {
                await ensureExt4Initialized();
                const unsparsedSize = BigInt(sourceFile.size);
                const readFn = makeReadFn(sourceFile);
                const content = read_ext4_file_stream(unsparsedSize, readFn, file._path);
                blob = new Blob([content]);
            }

            const downloadName = (subInfo && (subInfo.relPath === '/' || subInfo.relPath === '') && !name.endsWith('.img'))
                ? `${name}.img`
                : name;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error(`[ImgViewer.handleDownload] Failed to download ${name} at path ${file?._path}:`, err);
            const errMsg = `Failed to extract file: ${err?.message || err}`;
            setActionError(errMsg);
            try {
                alert(errMsg);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleOpen = async (file: any, name: string) => {
        if (!sourceFile) return;
        setActionError(null);
        try {
            let newFile: File;
            const subInfo = findSubImageForPath(file._path);

            if (subInfo) {
                if (subInfo.relPath === '/' || subInfo.relPath === '') {
                    // Opening the partition raw .img file itself in FileTool
                    const partitionFileName = name.endsWith('.img') ? name : `${name}.img`;
                    newFile = subInfo.sub.toBlob(partitionFileName);
                } else if (subInfo.isErofs) {
                    await ensureErofsInitialized();
                    const content = await read_erofs_file(subInfo.sub, subInfo.relPath);
                    newFile = new File([content], name, { type: 'application/octet-stream' });
                } else {
                    await ensureExt4Initialized();
                    const unsparsedSize = BigInt(subInfo.sub.unsparsedSize);
                    const readFn = (off: number, len: number) => subInfo.sub.readSync(off, len);
                    const content = read_ext4_file_stream(unsparsedSize, readFn, subInfo.relPath);
                    newFile = new File([content], name, { type: 'application/octet-stream' });
                }
            } else if (fsType === 'erofs') {
                await ensureErofsInitialized();
                const content = await read_erofs_file(sourceFile, file._path);
                newFile = new File([content], name, { type: 'application/octet-stream' });
            } else {
                await ensureExt4Initialized();
                const unsparsedSize = BigInt(sourceFile.size);
                const readFn = makeReadFn(sourceFile);
                const content = read_ext4_file_stream(unsparsedSize, readFn, file._path);
                newFile = new File([content], name, { type: 'application/octet-stream' });
            }

            window.parent?.postMessage({
                action: 'openFile',
                file: newFile
            }, "*");
        } catch (err: any) {
            console.error(`[ImgViewer.handleOpen] Failed to open ${name} at path ${file?._path}:`, err);
            const errMsg = `Failed to open file: ${err?.message || err}`;
            setActionError(errMsg);
            try {
                alert(errMsg);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const renderFileActions = (item: any, path: string[]) => {
        if (item._path) {
            const name = path[path.length - 1];
            return (
                <div className="file-actions">
                    <button onClick={() => handleOpen(item, name)} title="Open">
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                            <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z" />
                        </svg>
                    </button>
                    <button onClick={() => handleDownload(item, name)} title="Download">
                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                            <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                        </svg>
                    </button>
                </div>
            );
        }
        return null;
    };

    const renderFilePreview = (item: any, path: string[]) => {
        if (!item._path) return null;

        return (
            <div style={{ padding: '20px' }}>
                <h3>File Details</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #eee' }}>Path</td>
                            <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>{item._path}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #eee' }}>Size</td>
                            <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>{item._size.toLocaleString()} bytes</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #eee' }}>Mode</td>
                            <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>0o{item._mode.toString(8)}</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 'bold', padding: '4px', borderBottom: '1px solid #eee' }}>UID/GID</td>
                            <td style={{ padding: '4px', borderBottom: '1px solid #eee' }}>{item._uid} / {item._gid}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    if (error) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '20px',
                textAlign: 'center',
                color: '#333'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ margin: '0 0 12px 0', color: '#d32f2f' }}>Error Loading Image</h2>
                <div style={{
                    backgroundColor: '#fdecea',
                    color: '#d32f2f',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    maxWidth: '450px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    border: '1px solid #f5c6cb'
                }}>
                    {error}
                </div>
                <button
                    onClick={() => {
                        setError(null);
                        setTree(null);
                        setFsType(null);
                        setSourceFile(null);
                        setSubImageMap({});
                        ensureWasmInitialized().catch(() => {});
                        window.parent.postMessage({ action: 'requestFile' });
                    }}
                    style={{
                        marginTop: '20px',
                        padding: '8px 16px',
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Try again
                </button>
            </div>
        );
    }

    if (loading) {
        return <div style={{ padding: '20px' }}>Parsing image...</div>;
    }

    if (!tree) {
        return <div style={{ padding: '20px' }}>Waiting for file...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '0 20px' }}>
                <h2>{fsType === 'erofs' ? 'EROFS Image Explorer' : (fsType === 'super.img' ? 'Android super.img Explorer' : 'ext4 Image Explorer')}</h2>
            </div>
            {actionError && (
                <div style={{
                    margin: '0 20px 10px 20px',
                    padding: '8px 12px',
                    backgroundColor: '#fdecea',
                    color: '#d32f2f',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    fontSize: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>{actionError}</span>
                    <button
                        onClick={() => setActionError(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#d32f2f',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '16px',
                            marginLeft: '10px'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}
            <ColumnView
                initialContent={tree}
                renderFileActions={renderFileActions}
                renderFilePreview={renderFilePreview}
            />
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(<ImgViewer />);
}
