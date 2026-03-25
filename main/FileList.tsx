import React, { useState, useRef, useEffect } from 'react';
import { FileListItem } from "./fileitem";
import { processDataTransferItems } from './utils';
import { DropTarget } from './DropTarget';
import { AppFile, AppGroup } from './App';

interface SidebarProps {
    files: AppFile[];
    groups: AppGroup[];
    sidebarOrder: string[];
    setSidebarOrder: React.Dispatch<React.SetStateAction<string[]>>;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onRemoveFile: (id: string) => void;
    onRemoveGroup: (id: string) => void;
    onAddFiles: (files: File[]) => void;
    onGroupFiles: (ids: string[]) => void;
    onGroupAll: () => void;
    onToggleGroup: (id: string) => void;
    onUpdateFileParent: (fileId: string, parentId: string | null) => void;
}

export function FileList({ files, groups, sidebarOrder, setSidebarOrder, selectedId, onSelect, onRemoveFile, onRemoveGroup, onAddFiles, onGroupFiles, onGroupAll, onToggleGroup, onUpdateFileParent }: SidebarProps) {
    const [isDragOverSidebar, setIsDragOverSidebar] = useState(false);
    const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        setIsDragOverSidebar(false);
        e.preventDefault();

        const dragData = e.dataTransfer.getData('application/x-filetool-sidebar');
        if (dragData) {
            const { ids, sourceGroupId } = JSON.parse(dragData);
            // Reordering at the end of the sidebar
            setSidebarOrder(prev => {
                const filtered = prev.filter(id => !ids.includes(id));
                return [...filtered, ...ids];
            });
            // Move files to top-level if they were in a group
            ids.forEach((id: string) => {
                if (files.find(f => f.id === id)) {
                    onUpdateFileParent(id, null);
                }
            });
            return;
        }

        const newFiles = await processDataTransferItems(e.dataTransfer.items);
        onAddFiles(newFiles);
    }

    const topLevelFiles = files.filter(f => f.parentId === null);

    const handleItemClick = (e: React.MouseEvent, id: string) => {
        if (e.shiftKey && lastSelectedId) {
            // Basic shift-select implementation for linear list
            const allVisibleIds: string[] = [];
            sidebarOrder.forEach(itemId => {
                const group = groups.find(g => g.id === itemId);
                if (group) {
                    allVisibleIds.push(group.id);
                    if (group.isExpanded) {
                        allVisibleIds.push(...group.fileIds);
                    }
                } else {
                    allVisibleIds.push(itemId);
                }
            });
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

    const handleDragStart = (e: React.DragEvent, id: string) => {
        const ids = multiSelectedIds.includes(id) ? multiSelectedIds : [id];
        const group = groups.find(g => g.id === id);
        const file = files.find(f => f.id === id);
        const sourceGroupId = file?.parentId || null;

        e.dataTransfer.setData('application/x-filetool-sidebar', JSON.stringify({ ids, sourceGroupId }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOverItem = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnItem = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const dragData = e.dataTransfer.getData('application/x-filetool-sidebar');
        if (!dragData) return;

        const { ids } = JSON.parse(dragData);
        if (ids.includes(targetId)) return;

        setSidebarOrder(prev => {
            const filtered = prev.filter(id => !ids.includes(id));
            const targetIdx = filtered.indexOf(targetId);
            if (targetIdx === -1) return prev;
            const newOrder = [...filtered];
            newOrder.splice(targetIdx, 0, ...ids);
            return newOrder;
        });

        // When dropping on a file or group at the top level, those files should become top-level
        ids.forEach((id: string) => {
            if (files.find(f => f.id === id)) {
                onUpdateFileParent(id, null);
            }
        });
    };

    const handleDropOnGroup = (e: React.DragEvent, groupId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const dragData = e.dataTransfer.getData('application/x-filetool-sidebar');
        if (!dragData) return;

        const { ids } = JSON.parse(dragData);
        // Filter out groups being dragged into groups (not supported yet)
        const fileIds = ids.filter((id: string) => files.some(f => f.id === id));

        fileIds.forEach((id: string) => {
            onUpdateFileParent(id, groupId);
        });
    };

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
                    backgroundColor: isDragOverSidebar ? '#e6f3ff' : 'transparent',
                    userSelect: 'none'
                }}
                onDrop={onFileDrop}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                }}
                onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragOverSidebar(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOverSidebar(false);
                }}
            >
                <div style={{ flexGrow: 1 }}>
                    {sidebarOrder.map(id => {
                        const group = groups.find(g => g.id === id);
                        if (group) {
                            return (
                                <div key={group.id} style={{ marginBottom: '4px' }}>
                                    <div
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, group.id)}
                                        onDragOver={(e) => handleDragOverItem(e, group.id)}
                                        onDrop={(e) => handleDropOnItem(e, group.id)}
                                    >
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
                                            onDrop={(e) => handleDropOnGroup(e, group.id)}
                                        />
                                    </div>
                                    {group.isExpanded && (
                                        <div
                                            style={{ marginLeft: '16px', borderLeft: '1px solid #ddd', paddingLeft: '4px', minHeight: '8px' }}
                                            onDragOver={(e) => handleDragOverItem(e, group.id)}
                                            onDrop={(e) => handleDropOnGroup(e, group.id)}
                                        >
                                            {group.fileIds.map(fid => {
                                                const file = files.find(f => f.id === fid);
                                                if (!file) return null;
                                                return (
                                                    <div
                                                        key={file.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, file.id)}
                                                        onDragOver={(e) => handleDragOverItem(e, file.id)}
                                                        onDrop={(e) => handleDropOnItem(e, file.id)}
                                                    >
                                                        <FileListItem
                                                            file={file.file}
                                                            selected={selectedId === file.id}
                                                            multiSelected={multiSelectedIds.includes(file.id)}
                                                            onClick={(e) => handleItemClick(e, file.id)}
                                                            onRemove={() => onRemoveFile(file.id)}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        const file = files.find(f => f.id === id);
                        if (file) {
                            return (
                                <div
                                    key={file.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, file.id)}
                                    onDragOver={(e) => handleDragOverItem(e, file.id)}
                                    onDrop={(e) => handleDropOnItem(e, file.id)}
                                >
                                    <FileListItem
                                        file={file.file}
                                        selected={file.id === selectedId}
                                        multiSelected={multiSelectedIds.includes(file.id)}
                                        onClick={(e) => handleItemClick(e, file.id)}
                                        onRemove={() => onRemoveFile(file.id)}
                                    />
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>

                {isGroupSelected ? (
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
                ) : (
                    files.length > 1 && (
                        <button
                            onClick={onGroupAll}
                            style={{
                                marginBottom: '8px',
                                padding: '6px',
                                backgroundColor: '#fff',
                                color: '#0066cc',
                                border: '1px solid #0066cc',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Group all
                        </button>
                    )
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

function GroupHeader({ group, selected, multiSelected, onClick, onRemove, onDrop }: { group: AppGroup, selected: boolean, multiSelected: boolean, onClick: (e: React.MouseEvent) => void, onRemove: () => void, onDrop?: (e: React.DragEvent) => void }) {
    const [isHovered, setHovered] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onDragOver={(e) => {
                if (onDrop) {
                    e.preventDefault();
                    setIsDragOver(true);
                }
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
                if (onDrop) {
                    setIsDragOver(false);
                    onDrop(e);
                }
            }}
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                cursor: 'pointer',
                backgroundColor: isDragOver ? '#d1e9ff' : (selected || multiSelected ? '#e6f3ff' : (isHovered ? '#f0f0f0' : 'transparent')),
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
