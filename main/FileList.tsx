import React, { useState, useRef } from 'react';
import { FileListItem } from "./fileitem";
import { processDataTransferItems } from './utils';
import { DropTarget } from './DropTarget';

interface SidebarProps {
    files: File[];
    selected: number;
    onSelect: (index: number) => void;
    onRemove: (index: number) => void;
    onAddFiles: (files: File[]) => void;
}

export function FileList({ files, selected, onSelect, onRemove, onAddFiles }: SidebarProps) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        setIsDragging(false);
        e.preventDefault();

        const newFiles = await processDataTransferItems(e.dataTransfer.items);
        onAddFiles(newFiles);
    }

    return files.length === 0 ?
        (<DropTarget onFiles={onAddFiles} />)
        : (
            <div
                style={{
                    width: '200px',
                    borderRight: '1px solid #ccc',
                    padding: '8px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexShrink: 0,
                    flexDirection: 'column',
                    backgroundColor: isDragging ? '#e6f3ff' : 'transparent'
                }}
                onDrop={onFileDrop}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                }}
                onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                }}
            >
                <div style={{ flexGrow: 1 }}>
                    {files.map((file, index) => (
                        <FileListItem
                            key={`${file.name}-${file.lastModified}-${index}`}
                            file={file}
                            selected={index === selected}
                            onClick={() => onSelect(index)}
                            onRemove={() => onRemove(index)}
                        />
                    ))}
                </div>
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="add-file-button"
                >
                    Add file
                </div>
                <input
                    type="file"
                    style={{ display: 'none' }}
                    multiple
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && onAddFiles(Array.from(e.target.files))}
                />
            </div>
        );
}
