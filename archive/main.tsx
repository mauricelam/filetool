import { createRoot } from 'react-dom/client'
import { Archive, ArchiveCompression, ArchiveFormat, ArchiveFile, ArchiveEntryFile, ArchiveEntry } from 'libarchive.js';
import React, { useEffect, useState, useRef } from 'react';
import { ColumnView } from '../components/ColumnView';
import { HANDLERS, matchMimetype } from '../../main/handlers';

Archive.init({ workerUrl: 'libarchive-worker-bundle.js' });

const ROOT = createRoot(document.getElementById('root'))

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

async function handleFile(file: File) {
    ROOT.render(<ArchiveViewer initialFile={file} />)
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

interface FilePreviewerProps {
    archiveFile: ArchiveFile;
    fullPath: string[];
}

const FilePreviewer: React.FC<FilePreviewerProps> = ({ archiveFile, fullPath }) => {
    const [extractedFile, setExtractedFile] = useState<File | null>(null);
    const [handlerUrl, setHandlerUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        let alive = true;
        const extractAndDetermineHandler = async () => {
            try {
                const file = await archiveFile.extract();
                if (!alive) return;
                setExtractedFile(file);

                const fileName = fullPath[fullPath.length - 1] || file.name;
                let foundHandler = null;

                for (const handler of HANDLERS) {
                    for (const mimeMatch of handler.mimetypes) {
                        if (matchMimetype(mimeMatch, file.type, fileName, null)) {
                            foundHandler = handler;
                            break;
                        }
                    }
                    if (foundHandler) break;
                }

                if (foundHandler) {
                    // Assuming handlers are in subdirectories relative to the main app's root
                    // e.g. /textviewer/index.html if main app is at /
                    // Adjust if archive app is hosted in a subpath itself.
                    // For now, let's assume handlers are at /<handler_name>/index.html
                    setHandlerUrl(`/${foundHandler.handler}/index.html`);
                } else {
                    setError("No suitable preview handler found for this file type.");
                }

            } catch (e) {
                console.error("Error extracting file or finding handler:", e);
                if (alive) setError("Error extracting file for preview.");
            }
        };

        extractAndDetermineHandler();
        return () => { alive = false; };
    }, [archiveFile, fullPath]);

    useEffect(() => {
        if (extractedFile && handlerUrl && iframeRef.current) {
            const iframe = iframeRef.current;
            const sendData = async () => {
                try {
                    const data = await extractedFile.arrayBuffer();
                    // Ensure contentWindow is available before posting message
                    if (iframe.contentWindow) {
                         // Use window.origin for targetOrigin if handlers are same-origin,
                         // or be more specific if they are cross-origin.
                        iframe.contentWindow.postMessage({
                            fileData: data,
                            fileName: extractedFile.name,
                            filePath: fullPath,
                            action: 'displayFile' // Common action for handlers
                        }, window.origin, [data]);
                    } else {
                        console.warn("iframe contentWindow not available yet for postMessage");
                    }
                } catch (e) {
                    console.error("Error sending data to iframe:", e);
                    setError("Error sending data to preview handler.");
                }
            };

            // Post message when iframe is loaded
            const handleLoad = () => {
                sendData();
            };
            iframe.addEventListener('load', handleLoad);

            // If iframe is already loaded (e.g. src didn't change, but content did), try sending.
            // Check readyState, though it's not foolproof for all browsers or fast loads.
            if (iframe.contentWindow && iframe.ownerDocument.readyState === 'complete') {
                 sendData();
            }

            return () => {
                iframe.removeEventListener('load', handleLoad);
            };
        }
    }, [extractedFile, handlerUrl, fullPath]);

    if (error) {
        return <div style={{ padding: '10px', color: 'red' }}>{error}</div>;
    }

    if (!handlerUrl) {
        return <div style={{ padding: '10px' }}>Determining preview handler...</div>;
    }

    return (
        <iframe
            ref={iframeRef}
            src={handlerUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={`Preview of ${fullPath[fullPath.length - 1]}`}
            sandbox="allow-scripts allow-same-origin" // Adjust sandbox as needed by handlers
        />
    );
};


const ArchiveViewer: React.FC<{ initialFile: File }> = ({ initialFile }) => {
    const [archiveFile, setArchiveFile] = useState<File | null>(initialFile);
    const [files, setFiles] = useState<{ [key: string]: ArchiveFile }>({});
    const [isFormatDialogOpen, setIsFormatDialogOpen] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);

    useEffect(() => {
        const loadArchive = async () => {
            if (!archiveFile) return;
            const ar = await Archive.open(archiveFile);
            const files = await ar.getFilesObject();
            setFiles(files);
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

            // Process all entries recursively
            const filesToArchive = await Promise.all(
                Object.entries(extractedFiles).map(([path, entry]) => processEntry(entry, path))
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
        const extractedFile = await file.extract();
        window.parent?.postMessage({
            action: 'openFile',
            file: extractedFile
        }, "/", [await extractedFile.arrayBuffer()]);
    };

    const handleDownloadFile = async (file: ArchiveFile) => {
        const extractedFile = await file.extract();
        const url = URL.createObjectURL(extractedFile);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = extractedFile.name;
        anchor.click();
    };

    const renderFileActions = (file: ArchiveFile, path: string[]) => {
        if (!window.parent) return null;

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Archive Contents</h3>
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
                initialContent={files}
                renderFileActions={renderFileActions}
                renderPreview={(fileData, filePath) => <FilePreviewer archiveFile={fileData as ArchiveFile} fullPath={filePath} />}
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
