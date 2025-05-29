import { createRoot } from 'react-dom/client'
import { Archive } from 'libarchive.js';
import React, { useEffect, useState } from 'react';
import { ColumnView } from '../components/ColumnView';

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

const ArchiveViewer: React.FC<{ initialFile: File }> = ({ initialFile }) => {
    const [archiveFile, setArchiveFile] = useState<File | null>(initialFile);
    const [files, setFiles] = useState<{ [key: string]: any }>({});

    useEffect(() => {
        const loadArchive = async () => {
            if (!archiveFile) return;
            const ar = await Archive.open(archiveFile);
            const files = await ar.getFilesObject();
            setFiles(files);
        };

        loadArchive();
    }, [archiveFile]);

    const handleFileDownload = () => {
        if (archiveFile) {
            const url = URL.createObjectURL(archiveFile);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = archiveFile.name.replace(/\.[^/.]+$/, '') + '.zip';
            anchor.click();
            URL.revokeObjectURL(url);
        }
    };

    const handleOpenFile = async (file: any) => {
        const extractedFile = await file.extract();
        window.parent?.postMessage({
            action: 'openFile',
            file: extractedFile
        }, "/", [await extractedFile.arrayBuffer()]);
    };

    const handleDownloadFile = async (file: any) => {
        const extractedFile = await file.extract();
        const url = URL.createObjectURL(extractedFile);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = extractedFile.name;
        anchor.click();
    };

    const renderFileActions = (file: any, path: string[]) => {
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
                        onClick={handleFileDownload}
                        style={{
                            padding: '4px 8px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#666',
                            marginLeft: 'auto'
                        }}
                        title="Download as zip"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#666">
                            <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z" />
                        </svg>
                        Download as zip
                    </button>
                )}
            </div>
            <ColumnView
                initialContent={files}
                renderFileActions={renderFileActions}
            />
        </div>
    );
};
