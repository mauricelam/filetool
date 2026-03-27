import { createRoot } from 'react-dom/client'
import { Archive, ArchiveCompression, ArchiveFormat, ArchiveFile, ArchiveEntryFile, ArchiveEntry } from 'libarchive.js';
import React, { useEffect, useState } from 'react';
import { ColumnView } from '../components/ColumnView';
import { WASMagic, WASMagicFlags } from 'wasmagic';
import { PreviewComponent } from '../components/PreviewComponent';

Archive.init({ workerUrl: 'libarchive-worker-bundle.js' });

const ROOT = createRoot(document.getElementById('root')!)

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
    // Not supported due to https://github.com/nika-begiashvili/libarchivejs/issues/70
    // {
    //     id: 'zip',
    //     name: 'ZIP',
    //     format: ArchiveFormat.ZIP,
    //     compression: null
    // },
    // {
    //     id: '7z',
    //     name: '7Z',
    //     format: ArchiveFormat.SEVEN_ZIP,
    //     compression: null
    // },
    {
        id: 'tar.gz',
        name: 'TAR.GZ',
        format: ArchiveFormat.PAX,
        compression: ArchiveCompression.GZIP
    },
    {
        id: 'tar',
        name: 'TAR',
        format: ArchiveFormat.PAX,
        compression: null
    }
];

const FormatDialog: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (format: string) => void;
}> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    return (
        <div style={{
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
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                minWidth: '300px'
            }}>
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
                <button
                    onClick={onClose}
                    style={{
                        marginTop: '16px',
                        padding: '8px 16px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        background: '#f5f5f5',
                        cursor: 'pointer',
                        width: '100%'
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

interface ArchiveMetadata {
    fileName: string;
    description: string;
    fileCount: number;
    uncompressedSize: number;
    compressedSize: number;
    hasEncryptedData: boolean;
}

const MetadataViewer: React.FC<{ metadata: ArchiveMetadata | null, onBack: () => void }> = ({ metadata, onBack }) => {
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
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 'bold' }}>Encrypted</td>
                                <td style={{ padding: '8px 0' }}>{metadata.hasEncryptedData ? 'Yes' : 'No'}</td>
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
            const formatInfo = SUPPORTED_DOWNLOAD_FORMATS.find(f => f.id === format);
            if (!formatInfo) throw new Error('Unsupported format');

            const filesToArchive: ArchiveEntryFile[] = await Promise.all(files.map(async f => ({
                file: f,
                pathname: f.name
            } as unknown as ArchiveEntryFile)));

            const newArchiveFile = await Archive.write({
                files: filesToArchive,
                outputFileName: filename + (filename.endsWith('.' + format) ? '' : '.' + format),
                compression: formatInfo.compression,
                format: formatInfo.format,
                passphrase: null
            });

            const url = URL.createObjectURL(newArchiveFile);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = newArchiveFile.name;
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
    const [files, setFiles] = useState<{ [key: string]: ArchiveFile }>({});
    const [multiSelectedPaths, setMultiSelectedPaths] = useState<string[][]>([]);
    const [isFormatDialogOpen, setIsFormatDialogOpen] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [view, setView] = useState<'file' | 'metadata'>('file');
    const [metadata, setMetadata] = useState<ArchiveMetadata | null>(null);

    useEffect(() => {
        const loadArchive = async () => {
            if (!archiveFile) return;
            const ar = await Archive.open(archiveFile);
            const filesObj = await ar.getFilesObject();
            setFiles(filesObj);

            // Calculate metadata
            let uncompressedSize = 0;
            let fileCount = 0;

            const processFiles = (obj: any) => {
                for (const key in obj) {
                    const item = obj[key];
                    if (item.extract) {
                        // It's an ArchiveFile
                        uncompressedSize += item._size;
                        fileCount++;
                    } else {
                        // It's a directory
                        processFiles(item);
                    }
                }
            };
            processFiles(filesObj);

            const hasEncryptedData = await ar.hasEncryptedData();

            // Detect format using wasmagic. Only read first 1MB to avoid OOM.
            const magic = await WASMagic.create({ flags: WASMagicFlags.NONE });
            const head = archiveFile.slice(0, 1024 * 1024);
            const buffer = new Uint8Array(await head.arrayBuffer());
            const description = magic.detect(buffer);

            setMetadata({
                fileName: archiveFile.name,
                description,
                fileCount,
                uncompressedSize,
                compressedSize: archiveFile.size,
                hasEncryptedData
            });
        };

        loadArchive();
    }, [archiveFile]);

    const handleFileDownload = async (format: string) => {
        if (!archiveFile) return;

        setIsCompressing(true);
        try {
            const formatInfo = SUPPORTED_DOWNLOAD_FORMATS.find(f => f.id === format);
            if (!formatInfo) throw new Error('Unsupported format');

            const ar = await Archive.open(archiveFile);
            const extractedFiles: { [key: string]: ArchiveEntry } = await ar.getFilesObject();

            // Helper function to recursively process files and directories
            const processEntry = async (entry: ArchiveEntry, currentPath: string): Promise<ArchiveEntryFile[]> => {
                try {
                    if (typeof (entry as ArchiveFile).extract === 'function') {
                        // It's a file
                        const file = entry as ArchiveFile;
                        try {
                            const extractedFile = await file.extract();
                            return [{
                                file: extractedFile,
                                pathname: file._path
                            } as unknown as ArchiveEntryFile];
                        } catch (extractError) {
                            console.error('Error extracting file:', file._path, extractError);
                            return [];
                        }
                    } else {
                        // It's a directory
                        const dir = entry as { [filename: string]: ArchiveEntry };
                        const results: ArchiveEntryFile[] = [];
                        for (const [filename, nestedEntry] of Object.entries(dir)) {
                            const nestedPath = currentPath ? `${currentPath}/${filename}` : filename;
                            const nestedFiles = await processEntry(nestedEntry, nestedPath);
                            results.push(...nestedFiles);
                        }
                        return results;
                    }
                } catch (error) {
                    console.error('Error processing entry:', currentPath, error);
                    return [];
                }
            };

            // Process entries recursively, filtering by multi-selection if active
            let entriesToProcess = Object.entries(extractedFiles);

            if (multiSelectedPaths.length > 0) {
                const findEntryByPath = (obj: any, pathArr: string[]): ArchiveEntry | undefined => {
                    let current = obj;
                    for (const segment of pathArr) {
                        if (current && typeof current === 'object' && segment in current) {
                            current = current[segment];
                        } else {
                            return undefined;
                        }
                    }
                    return current;
                };

                const selectedEntries: [string, ArchiveEntry][] = multiSelectedPaths.map(path => {
                    const entry = findEntryByPath(extractedFiles, path);
                    return entry ? [path.join('/'), entry] : null;
                }).filter((x): x is [string, ArchiveEntry] => x !== null);

                entriesToProcess = selectedEntries;
            }

            const filesToArchive = await Promise.all(
                entriesToProcess.map(([path, entry]) => processEntry(entry, path))
            ).then(results => results.flat());

            if (filesToArchive.length === 0) {
                throw new Error('No files were successfully extracted from the archive');
            }

            // Create new archive
            console.log('write archive', formatInfo.compression, formatInfo.format, formatInfo)
            const newArchiveFile = await Archive.write({
                files: filesToArchive,
                outputFileName: archiveFile.name.replace(/\.[^/.]+$/, '') + '.' + format,
                compression: formatInfo.compression,
                format: formatInfo.format,
                passphrase: null
            });

            // Download the new archive
            const url = URL.createObjectURL(newArchiveFile);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = newArchiveFile.name;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error creating archive:', error);
            alert('Failed to create archive. Please try again.');
        } finally {
            setIsCompressing(false);
        }
    };

    const handleOpenFile = async (file: ArchiveFile) => {
        try {
            const extractedFile = await file.extract();
            window.parent?.postMessage({
                action: 'openFile',
                file: extractedFile
            }, "/", [await extractedFile.arrayBuffer()]);
        } catch (e) {
            console.error('Error opening file:', e);
        }
    };

    const handleDownloadFile = async (file: ArchiveFile) => {
        try {
            const extractedFile = await file.extract();
            const url = URL.createObjectURL(extractedFile);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = extractedFile.name;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Error downloading file:', e);
        }
    };

    const renderFileActions = (file: ArchiveFile, path: string[]) => {
        if (!window.parent) return null;

        return (
            <div className="file-actions">
                <button onClick={() => handleDownloadFile(file)} title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343">
                        <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                    </svg>
                </button>
            </div>
        );
    };

    const getDexFiles = (obj: any): ArchiveFile[] => {
        const results: ArchiveFile[] = [];
        const find = (o: any) => {
            for (const key in o) {
                const item = o[key];
                if (item && typeof item === 'object') {
                    if (item.extract) {
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
        const dexFiles = getDexFiles(files);

        if (dexFiles.length === 0) return;

        try {
            // Sort to have classes.dex first if possible
            dexFiles.sort((a, b) => a._path.localeCompare(b._path));

            const extractedFiles = await Promise.all(dexFiles.map(f => f.extract()));
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

    const handleOpenSelected = async () => {
        if (!archiveFile || multiSelectedPaths.length === 0) return;

        setIsCompressing(true);
        try {
            const ar = await Archive.open(archiveFile);
            const extractedFilesObj: { [key: string]: ArchiveEntry } = await ar.getFilesObject();

            const findEntryByPath = (obj: any, pathArr: string[]): ArchiveEntry | undefined => {
                let current = obj;
                for (const segment of pathArr) {
                    if (current && typeof current === 'object' && segment in current) {
                        current = current[segment];
                    } else {
                        return undefined;
                    }
                }
                return current;
            };

            const selectedFiles: File[] = [];
            for (const pathArr of multiSelectedPaths) {
                const entry = findEntryByPath(extractedFilesObj, pathArr);
                if (entry && typeof (entry as ArchiveFile).extract === 'function') {
                    selectedFiles.push(await (entry as ArchiveFile).extract());
                }
            }

            if (selectedFiles.length === 0) return;

            const primaryFile = selectedFiles[0];
            const additionalFiles = selectedFiles.slice(1);

            window.parent?.postMessage({
                action: 'openFile',
                file: primaryFile,
                additionalFiles: additionalFiles
            }, "/", [
                await primaryFile.arrayBuffer(),
                ...await Promise.all(additionalFiles.map(f => f.arrayBuffer()))
            ]);
        } catch (e) {
            console.error('Error opening selected files:', e);
        } finally {
            setIsCompressing(false);
        }
    };

    const renderFilePreview = (file: ArchiveFile, path: string[]) => {
        async function extractFile(): Promise<File> {
            const extracted: File = await file.extract()
            // Copy the file to remove the mimetype. For some reason
            // libarchive.js adds application/octet-stream to this result.
            return new File([extracted], extracted.name, {})
        }
        return <PreviewComponent path={path} filePromise={extractFile} />;
    };

    if (view === 'metadata') {
        return <MetadataViewer metadata={metadata} onBack={() => setView('file')} />;
    }

    const hasMultipleDex = getDexFiles(files).length > 1;

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
                    <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                        <button
                            onClick={handleOpenSelected}
                            disabled={isCompressing || multiSelectedPaths.length === 0}
                            style={{
                                padding: '4px 8px',
                                border: 'none',
                                background: 'transparent',
                                cursor: (isCompressing || multiSelectedPaths.length === 0) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: (isCompressing || multiSelectedPaths.length === 0) ? '#999' : '#666',
                            }}
                            title={multiSelectedPaths.length > 1 ? "Open Selected" : "Open"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill={(isCompressing || multiSelectedPaths.length === 0) ? "#999" : "#666"}>
                                <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z" />
                            </svg>
                            {multiSelectedPaths.length > 1 ? "Open Selected" : "Open"}
                        </button>
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
                            }}
                            title={isCompressing ? "Compressing..." : (multiSelectedPaths.length > 1 ? "Download Selected" : "Download")}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill={isCompressing ? "#999" : "#666"}>
                                <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                            </svg>
                            {isCompressing ? "Compressing..." : (multiSelectedPaths.length > 1 ? "Download Selected" : "Download")}
                        </button>
                    </div>
                )}
            </div>
            <ColumnView
                initialContent={files}
                onSelectionChange={setMultiSelectedPaths}
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
