import React, { useState, useRef, useEffect } from 'react';
import { FileListItem } from "./fileitem";
import { processDataTransferItems } from './utils';
import { DropTarget } from './DropTarget';
import { AppFile, AppGroup } from './App';

interface SidebarProps {
    files: AppFile[];
    groups: AppGroup[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onRemoveFile: (id: string) => void;
    onRemoveGroup: (id: string) => void;
    onAddFiles: (files: File[]) => void;
    onGroupFiles: (ids: string[]) => void;
    onToggleGroup: (id: string) => void;
}

export function FileList({ files, groups, selectedId, onSelect, onRemoveFile, onRemoveGroup, onAddFiles, onGroupFiles, onToggleGroup }: SidebarProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        setIsDragging(false);
        e.preventDefault();

        const newFiles = await processDataTransferItems(e.dataTransfer.items);
        onAddFiles(newFiles);
    }

    const topLevelFiles = files.filter(f => f.parentId === null);

    const handleItemClick = (e: React.MouseEvent, id: string) => {
        if (e.shiftKey && lastSelectedId) {
            // Basic shift-select implementation for linear list
            const allVisibleIds = [
                ...groups.flatMap(g => [g.id, ...(g.isExpanded ? g.fileIds : [])]),
                ...topLevelFiles.map(f => f.id)
            ];
            const startIdx = allVisibleIds.indexOf(lastSelectedId);
            const endIdx = allVisibleIds.indexOf(id);
            if (startIdx !== -1 && endIdx !== -1) {
                const selection = allVisibleIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
                setMultiSelectedIds(selection);
            }
        } else if (e.ctrlKey || e.metaKey) {
            setMultiSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
            setLastSelectedId(id);
        } else {
            setMultiSelectedIds([]);
            setLastSelectedId(id);
            onSelect(id);
        }
    };

    const isGroupSelected = multiSelectedIds.length > 1;

    return files.length === 0 ?
        (<DropTarget onFiles={onAddFiles} />)
        : (
            <div
                className="sidebar"
                style={{
                    width: '240px',
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
                    {groups.map(group => (
                        <div key={group.id} style={{ marginBottom: '4px' }}>
                            <GroupHeader
                                group={group}
                                selected={selectedId === group.id}
                                multiSelected={multiSelectedIds.includes(group.id)}
                                onClick={(e) => {
                                    handleItemClick(e, group.id);
                                    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                                        onToggleGroup(group.id);
                                    }
                                }}
                                onRemove={() => onRemoveGroup(group.id)}
                            />
                            {group.isExpanded && (
                                <div style={{ marginLeft: '16px', borderLeft: '1px solid #ddd', paddingLeft: '4px' }}>
                                    {group.fileIds.map(fid => {
                                        const file = files.find(f => f.id === fid);
                                        if (!file) return null;
                                        return (
                                            <FileListItem
                                                key={file.id}
                                                file={file.file}
                                                selected={selectedId === file.id}
                                                multiSelected={multiSelectedIds.includes(file.id)}
                                                onClick={(e) => handleItemClick(e, file.id)}
                                                onRemove={() => onRemoveFile(file.id)}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                    {topLevelFiles.map((file) => (
                        <FileListItem
                            key={file.id}
                            file={file.file}
                            selected={file.id === selectedId}
                            multiSelected={multiSelectedIds.includes(file.id)}
                            onClick={(e) => handleItemClick(e, file.id)}
                            onRemove={() => onRemoveFile(file.id)}
                        />
                    ))}
                </div>

                {isGroupSelected && (
                    <button
                        onClick={() => {
                            onGroupFiles(multiSelectedIds.filter(id => files.some(f => f.id === id)));
                            setMultiSelectedIds([]);
                        }}
                        style={{
                            marginBottom: '8px',
                            padding: '6px',
                            backgroundColor: '#0066cc',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Group selected
                    </button>
                )}

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

function GroupHeader({ group, selected, multiSelected, onClick, onRemove }: { group: AppGroup, selected: boolean, multiSelected: boolean, onClick: (e: React.MouseEvent) => void, onRemove: () => void }) {
    const [isHovered, setHovered] = useState(false);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                cursor: 'pointer',
                backgroundColor: selected || multiSelected ? '#e6f3ff' : (isHovered ? '#f0f0f0' : 'transparent'),
                border: selected ? '1px solid #0066cc' : '1px solid transparent',
                borderRadius: '4px',
                justifyContent: 'space-between',
                fontWeight: 'bold'
            }}>
            <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#666" style={{ marginRight: 8, flexShrink: 0 }}>
                    <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z" />
                </svg>
                <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '13px'
                }}>{group.name}</span>
            </div>
            <div
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                style={{
                    visibility: isHovered || selected ? 'visible' : 'hidden',
                    marginLeft: '8px',
                    padding: '2px',
                    lineHeight: '1',
                    borderRadius: '50%',
                }}
            >
                ×
            </div>
        </div>
    );
}
