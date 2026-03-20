import { createRoot } from 'react-dom/client'
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ColumnView } from '../components/ColumnView';
import { WASMagic, WASMagicFlags } from 'wasmagic';
import { PreviewComponent } from '../components/PreviewComponent';
import { ArchiveMetadata, ArchiveEntryInfo, FileToArchive } from './archive-wasm/pkg/archive_wasm';

const ROOT = createRoot(document.getElementById('root')!)

// Worker management
let worker: Worker | null = null;
let pendingPromises: { [key: string]: { resolve: (val: any) => void, reject: (err: any) => void } } = {};
let messageId = 0;

function getWorker(): Promise<Worker> {
    if (worker) return Promise.resolve(worker);
    return new Promise((resolve, reject) => {
        worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
            const { type, metadata, data, entryName, message, id } = e.data;
            if (type === 'ready') {
                resolve(worker!);
            } else if (type === 'error') {
                if (id !== undefined && pendingPromises[id]) {
                    pendingPromises[id].reject(new Error(message));
                    delete pendingPromises[id];
                } else {
                    console.error('Worker error:', message);
                }
            } else if (id !== undefined && pendingPromises[id]) {
                pendingPromises[id].resolve(e.data);
                delete pendingPromises[id];
            }
        };
        worker.onerror = (e) => {
            console.error('Worker global error:', e);
            reject(e);
        }
    });
}

async function callWorker(action: string, args: any): Promise<any> {
    const w = await getWorker();
    const id = ++messageId;
    return new Promise((resolve, reject) => {
        pendingPromises[id] = { resolve, reject };
        w.postMessage({ action, ...args, id }, args.data instanceof ArrayBuffer ? [args.data] : []);
    });
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file, e.data.additionalFiles || [])
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

async function handleFile(file: File, additionalFiles: File[]) {
    if (additionalFiles.length > 0) {
        ROOT.render(<ArchiveCreator files={[file, ...additionalFiles]} />)
    } else {
        ROOT.render(<ArchiveViewer initialFile={file} />)
    }
}

const SUPPORTED_DOWNLOAD_FORMATS = [
    {
        id: 'zip',
        name: 'ZIP',
    },
    {
        id: 'tar.gz',
        name: 'TAR.GZ',
    }
];

const FormatDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (format: string) => void;
}> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    minWidth: '300px',
                    position: 'relative'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#434343">
                        <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
                    </svg>
                </button>
                <h3 style={{ margin: '0 0 16px 0' }}>Select Archive Format</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {SUPPORTED_DOWNLOAD_FORMATS.map(format => (
                        <button
                            key={format.id}
                            onClick={() => onSelect(format.id)}
                            style={{
                                padding: '8px 16px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                background: 'white',
                                cursor: 'pointer',
                                textAlign: 'left'
                            }}
                        >
                            {format.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

interface ArchiveViewerMetadata {
    fileName: string;
    description: string;
    fileCount: number;
    uncompressedSize: number;
    compressedSize: number;
}

const MetadataViewer: React.FC<{ metadata: ArchiveViewerMetadata | null, onBack: () => void }> = ({ metadata, onBack }) => {
    if (!metadata) return null;

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const compressionRatio = metadata.uncompressedSize > 0
        ? ((1 - metadata.compressedSize / metadata.uncompressedSize) * 100).toFixed(1)
        : '0';

    return (
        <div style={{ padding: '20px', height: '100%', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <button
                    onClick={onBack}
                    style={{
                        padding: '8px 16px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                    </svg>
                    Back to Files
                </button>
                <h2 style={{ margin: 0 }}>Archive Metadata</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <section style={{ border: '1px solid #eee', padding: '16px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px' }}>File Information</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold', width: '150px' }}>Filename</td>
                                <td style={{ padding: '8px 0', wordBreak: 'break-all' }}>{metadata.fileName}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Format</td>
                                <td style={{ padding: '8px 0' }}>{metadata.description}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section style={{ border: '1px solid #eee', padding: '16px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Archive Details</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold', width: '150px' }}>File Count</td>
                                <td style={{ padding: '8px 0' }}>{metadata.fileCount}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Compressed Size</td>
                                <td style={{ padding: '8px 0' }}>{formatSize(metadata.compressedSize)}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Uncompressed Size</td>
                                <td style={{ padding: '8px 0' }}>{formatSize(metadata.uncompressedSize)}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Compression Ratio</td>
                                <td style={{ padding: '8px 0' }}>{compressionRatio}% savings</td>
                            </tr>
                        </tbody>
                    </table>
                </section>
            </div>
        </div>
    );
};

const ArchiveCreator: React.FC<{ files: File[] }> = ({ files }) => {
    const [isCompressing, setIsCompressing] = useState(false);
    const [format, setFormat] = useState('tar.gz');
    const [filename, setFilename] = useState('archive');

    const handleCreate = async () => {
        setIsCompressing(true);
        try {
            const filesToArchive: FileToArchive[] = await Promise.all(files.map(async f => ({
                name: f.name,
                data: new Uint8Array(await f.arrayBuffer())
            })));

            const action = format === 'zip' ? 'create_zip' : 'create_tar_gz';
            const { data } = await callWorker(action, { files: filesToArchive });

            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            const fullFilename = filename + (filename.endsWith('.' + format) ? '' : '.' + format);
            anchor.download = fullFilename;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error creating archive:', error);
            alert('Failed to create archive.');
        } finally {
            setIsCompressing(false);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Create Archive</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontWeight: 'bold' }}>Filename</label>
                    <input
                        type="text"
                        value={filename}
                        onChange={e => setFilename(e.target.value)}
                        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontWeight: 'bold' }}>Format</label>
                    <select
                        value={format}
                        onChange={e => setFormat(e.target.value)}
                        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                        {SUPPORTED_DOWNLOAD_FORMATS.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ marginTop: '10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Files to include ({files.length}):</div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px', padding: '8px' }}>
                        {files.map((f, i) => (
                            <div key={i} style={{ fontSize: '14px', padding: '4px 0' }}>{f.name}</div>
                        ))}
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    disabled={isCompressing}
                    style={{
                        padding: '12px',
                        backgroundColor: '#0066cc',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isCompressing ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        marginTop: '10px'
                    }}
                >
                    {isCompressing ? 'Creating Archive...' : 'Create and Download'}
                </button>
            </div>
        </div>
    );
};

const ArchiveViewer: React.FC<{ initialFile: File }> = ({ initialFile }) => {
    const [archiveFile, setArchiveFile] = useState<File | null>(initialFile);
    const [filesObject, setFilesObject] = useState<{ [key: string]: any }>({});
    const [isFormatDialogOpen, setIsFormatDialogOpen] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [view, setView] = useState<'file' | 'metadata'>('file');
    const [metadata, setMetadata] = useState<ArchiveViewerMetadata | null>(null);

    useEffect(() => {
        const loadArchive = async () => {
            if (!archiveFile) return;
            try {
                const buffer = await archiveFile.arrayBuffer();
                const { metadata: wasmMetadata } = await callWorker('list', { data: buffer });
                const entries: ArchiveEntryInfo[] = wasmMetadata.entries;

                // Build hierarchical object for ColumnView
                const root: { [key: string]: any } = {};
                let totalUncompressedSize = 0;

                entries.forEach(entry => {
                    const parts = entry.name.split('/');
                    let current = root;
                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i];
                        if (i === parts.length - 1) {
                            if (!entry.is_directory) {
                                current[part] = {
                                    _path: entry.name,
                                    _size: entry.size,
                                    _is_file: true
                                };
                                totalUncompressedSize += entry.size;
                            } else {
                                current[part] = current[part] || {};
                            }
                        } else {
                            current[part] = current[part] || {};
                            current = current[part];
                        }
                    }
                });

                setFilesObject(root);

                // Detect format description using wasmagic
                const magic = await WASMagic.create({ flags: WASMagicFlags.NONE });
                const head = archiveFile.slice(0, 1024 * 1024);
                const magicBuffer = new Uint8Array(await head.arrayBuffer());
                const description = magic.detect(magicBuffer);

                setMetadata({
                    fileName: archiveFile.name,
                    description: description || wasmMetadata.format,
                    fileCount: entries.filter(e => !e.is_directory).length,
                    uncompressedSize: totalUncompressedSize,
                    compressedSize: archiveFile.size
                });
            } catch (e) {
                console.error('Failed to load archive:', e);
            }
        };

        loadArchive();
    }, [archiveFile]);

    const handleFileDownload = async (format: string) => {
        if (!archiveFile) return;
        setIsCompressing(true);
        try {
            // Re-archive all files
            const buffer = await archiveFile.arrayBuffer();
            const { metadata: wasmMetadata } = await callWorker('list', { data: buffer.slice(0) });
            const entries: ArchiveEntryInfo[] = wasmMetadata.entries;

            const filesToArchive: FileToArchive[] = await Promise.all(
                entries.filter(e => !e.is_directory).map(async e => {
                    const { data } = await callWorker('extract', { data: buffer.slice(0), entryName: e.name });
                    return { name: e.name, data: new Uint8Array(data) };
                })
            );

            const action = format === 'zip' ? 'create_zip' : 'create_tar_gz';
            const { data } = await callWorker(action, { files: filesToArchive });

            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = archiveFile.name.replace(/\.[^/.]+$/, '') + '.' + format;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error creating archive:', error);
            alert('Failed to create archive.');
        } finally {
            setIsCompressing(false);
        }
    };

    const handleOpenFile = async (file: any) => {
        if (!archiveFile) return;
        try {
            const buffer = await archiveFile.arrayBuffer();
            const { data } = await callWorker('extract', { data: buffer, entryName: file._path });
            const extractedFile = new File([data], file._path.split('/').pop()!, { type: 'application/octet-stream' });
            window.parent?.postMessage({
                action: 'openFile',
                file: extractedFile
            }, "/", [data]);
        } catch (e) {
            console.error('Error opening file:', e);
        }
    };

    const handleDownloadFile = async (file: any) => {
        if (!archiveFile) return;
        try {
            const buffer = await archiveFile.arrayBuffer();
            const { data } = await callWorker('extract', { data: buffer, entryName: file._path });
            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = file._path.split('/').pop()!;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Error downloading file:', e);
        }
    };

    const renderFileActions = (file: any, path: string[]) => {
        if (!window.parent || !file._is_file) return null;

        return (
            <div className="file-actions">
                <button onClick={() => handleOpenFile(file)} title="Open">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z" />
                    </svg>
                </button>
                <button onClick={() => handleDownloadFile(file)} title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                    </svg>
                </button>
            </div>
        );
    };

    const getDexFiles = (obj: any): any[] => {
        const results: any[] = [];
        const find = (o: any) => {
            for (const key in o) {
                const item = o[key];
                if (item && typeof item === 'object') {
                    if (item._is_file) {
                        if (key.toLowerCase().endsWith('.dex')) {
                            results.push(item);
                        }
                    } else {
                        find(item);
                    }
                }
            }
        };
        find(obj);
        return results;
    };

    const handleOpenMultiDex = async () => {
        if (!archiveFile) return;
        const dexFiles = getDexFiles(filesObject);

        if (dexFiles.length === 0) return;

        try {
            dexFiles.sort((a, b) => a._path.localeCompare(b._path));

            const buffer = await archiveFile.arrayBuffer();
            const extractedFiles = await Promise.all(dexFiles.map(async f => {
                const { data } = await callWorker('extract', { data: buffer.slice(0), entryName: f._path });
                return new File([data], f._path.split('/').pop()!, { type: 'application/octet-stream' });
            }));

            const primaryFile = extractedFiles[0];
            const additionalFiles = extractedFiles.slice(1);

            window.parent?.postMessage({
                action: 'openFile',
                file: primaryFile,
                additionalFiles: additionalFiles,
                handler: 'dexviewer'
            }, "/", [
                await primaryFile.arrayBuffer(),
                ...await Promise.all(additionalFiles.map(f => f.arrayBuffer()))
            ]);
        } catch (e) {
            console.error('Error opening multiple DEX files:', e);
        }
    };

    const renderFilePreview = (file: any, path: string[]) => {
        async function extractFile(): Promise<File> {
            if (!archiveFile) throw new Error('No archive file');
            const buffer = await archiveFile.arrayBuffer();
            const { data } = await callWorker('extract', { data: buffer, entryName: file._path });
            return new File([data], file._path.split('/').pop()!, { type: 'application/octet-stream' });
        }
        return <PreviewComponent path={path} filePromise={extractFile} />;
    };

    if (view === 'metadata') {
        return <MetadataViewer metadata={metadata} onBack={() => setView('file')} />;
    }

    const hasMultipleDex = getDexFiles(filesObject).length > 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Archive Contents</h3>
                {hasMultipleDex && (
                    <button
                        onClick={handleOpenMultiDex}
                        style={{
                            padding: '4px 12px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 500
                        }}
                    >
                        Analyze all DEX files
                    </button>
                )}
                {metadata && (
                    <button
                        onClick={() => setView('metadata')}
                        style={{
                            padding: '4px 12px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        View Metadata
                    </button>
                )}
                {archiveFile && (
                    <button
                        onClick={() => setIsFormatDialogOpen(true)}
                        disabled={isCompressing}
                        style={{
                            padding: '4px 8px',
                            border: 'none',
                            background: 'transparent',
                            cursor: isCompressing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: isCompressing ? '#999' : '#666',
                            marginLeft: 'auto'
                        }}
                        title={isCompressing ? "Compressing..." : "Download"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill={isCompressing ? "#999" : "#666"}>
                            <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                        </svg>
                        {isCompressing ? "Compressing..." : "Download"}
                    </button>
                )}
            </div>
            <ColumnView
                initialContent={filesObject}
                renderFileActions={renderFileActions}
                renderFilePreview={renderFilePreview}
            />
            <FormatDialog
                isOpen={isFormatDialogOpen}
                onClose={() => setIsFormatDialogOpen(false)}
                onSelect={(format) => {
                    handleFileDownload(format);
                    setIsFormatDialogOpen(false);
                }}
            />
        </div>
    );
};
