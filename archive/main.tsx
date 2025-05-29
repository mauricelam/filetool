import { createRoot } from 'react-dom/client'
import { Archive } from 'libarchive.js';
import React, { useEffect, useState, useRef } from 'react';

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
    const [selectedPath, setSelectedPath] = useState<string[]>([]);
    const [columns, setColumns] = useState<any[]>([]);

    const columnsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadArchive = async () => {
            if (!archiveFile) return;
            // await init(); // No longer needed with libarchive.js
            const ar = await Archive.open(archiveFile);
            const files = await ar.getFilesObject();
            setColumns([{ path: [], content: files }]);
        };

        loadArchive();

    }, [archiveFile]); // Depend on archiveFile state

    const handleItemClick = (level: number, key: string, content: any) => {
        const newPath = [...selectedPath.slice(0, level), key];
        setSelectedPath(newPath);

        // Update columns - always add a new column for directories
        const newColumns = columns.slice(0, level + 1);
        if (!('extract' in content)) {  // If it's a directory
            newColumns.push({ path: newPath, content });
        }
        setColumns(newColumns);

        // Scroll to the right after the new column is added
        if (!('extract' in content)) {
            setTimeout(() => {
                if (columnsContainerRef.current) {
                    columnsContainerRef.current.scrollLeft = columnsContainerRef.current.scrollWidth;
                }
            }, 0);
        }
    };

    const handleFileDownload = () => {
        if (archiveFile) {
            const url = URL.createObjectURL(archiveFile);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = archiveFile.name.replace(/\.[^/.]+$/, '') + '.zip'; // Suggest .zip extension
            anchor.click();
            URL.revokeObjectURL(url);
        }
    };

    const renderColumn = (level: number, content: any) => {
        if (!content || typeof content !== 'object') {
            return (
                <div className="column-content">
                    <div className="value">{String(content)}</div>
                </div>
            );
        }

        const items = Object.entries(content);
        return (
            <div className="column-content">
                {items.map(([key, value]) => {
                    const isDirectory = value && typeof value === 'object' && !('extract' in value);
                    const isSelected = selectedPath[level] === key;

                    return (
                        <div
                            key={key}
                            className={`column-item ${isSelected ? 'selected' : ''} ${isDirectory ? 'has-children' : ''}`}
                            onClick={() => handleItemClick(level, key, value)}
                            title={key}
                        >
                            <div className="item-name">
                                {isDirectory ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                                        <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z" />
                                    </svg>
                                ) : null}
                                {key}
                            </div>
                            {!isDirectory && renderFileActions(value)}
                        </div>
                    );
                })}
            </div>
        );
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

    const renderFileActions = (file: any) => {
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', gap: '20px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <button
                    onClick={() => { /* handle back logic here if needed */ }}
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
                    Back
                </button>
                <h3 style={{ margin: 0 }}>Archive Contents</h3>

                {/* Download Button */}
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
            <div style={{ flex: 1, display: 'flex', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                <div className="columns-container" ref={columnsContainerRef} style={{ display: 'flex', flex: 1, overflow: 'auto' }}>
                    {columns.map((column, index) => (
                        <div
                            key={index}
                            style={{
                                width: '250px',
                                minWidth: '250px',
                                maxWidth: '250px',
                                borderRight: '1px solid #ccc',
                                overflow: 'auto',
                                height: '100%'
                            }}
                        >
                            {renderColumn(index, column.content)}
                        </div>
                    ))}
                </div>
            </div>
            <style>
                {`
                    *, *::before, *::after {
                        box-sizing: border-box;
                    }
                    html, body, #output {
                        height: 100%;
                        margin: 0;
                        padding: 0;
                    }
                    #output > div {
                        height: 100%;
                    }
                    .column-content {
                        padding: 8px;
                        height: 100%;
                        overflow: auto;
                    }
                    .column-item {
                        padding: 8px;
                        cursor: pointer;
                        border-radius: 4px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        white-space: nowrap;
                        overflow: hidden;
                    }
                    .column-item:hover {
                        background-color: #f0f0f0;
                    }
                    .column-item.selected {
                        background-color: #e0e0e0;
                    }
                    .item-name {
                        font-weight: 500;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        flex: 1;
                        min-width: 0;
                    }
                    .item-type {
                        color: #666;
                        font-size: 0.9em;
                    }
                    .value {
                        color: #666;
                        font-family: monospace;
                    }
                    .file-actions {
                        display: flex;
                        gap: 8px;
                        margin-left: 8px;
                    }
                    .file-actions button {
                        background: none;
                        border: none;
                        padding: 4px;
                        cursor: pointer;
                        border-radius: 4px;
                    }
                    .file-actions button:hover {
                        background-color: #f0f0f0;
                    }
                `}
            </style>
        </div>
    );
}
