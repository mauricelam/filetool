import { Archive } from 'libarchive.js';
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

Archive.init({ workerUrl: 'libarchive-worker-bundle.js' });

const ArchiveViewer: React.FC = () => {
    const [archive, setArchive] = useState<any>(null);
    const [selectedPath, setSelectedPath] = useState<string[]>([]);
    const [columns, setColumns] = useState<any[]>([]);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.data.action === 'respondFile') {
                const ar = await Archive.open(e.data.file);
                const files = await ar.getFilesObject();
                setArchive(files);
                setColumns([{ path: [], content: files }]);
            }
        };

        window.addEventListener('message', handleMessage);
        if (window.parent) {
            window.parent.postMessage({ action: 'requestFile' });
        }

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

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
                document.documentElement.scrollLeft = document.documentElement.scrollWidth;
            }, 0);
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', gap: '20px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <h3>Archive Contents</h3>
                <div style={{ flex: 1, display: 'flex', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                    {archive ? (
                        <div className="columns-container" style={{ display: 'flex', flex: 1, overflow: 'auto' }}>
                            {columns.map((column, index) => (
                                <div
                                    key={index}
                                    style={{
                                        width: '250px',
                                        minWidth: '250px',
                                        maxWidth: '250px',
                                        borderRight: '1px solid #ccc',
                                        overflow: 'auto'
                                    }}
                                >
                                    {renderColumn(index, column.content)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '10px', color: '#666' }}>No archive loaded</div>
                    )}
                </div>
            </div>
            <style>
                {`
                    .column-content {
                        padding: 8px;
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
};

const container = document.getElementById('filelist');
if (container) {
    const root = createRoot(container);
    root.render(<ArchiveViewer />);
} else {
    console.error("Could not find root element 'filelist'");
}
