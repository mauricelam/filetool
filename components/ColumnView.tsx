import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Props for the ColumnView component
 */
interface ColumnViewProps<T> {
    /** The initial content to display in the column view. Should be an object where keys are item names and values are either nested objects (for directories) or any other type (for files) */
    initialContent: { [key: string]: T };
    /** The path to select and highlight in the column view */
    selectedPath?: string[];
    /** Optional callback function that is called when an item is clicked. Receives the level (column index), key (item name), and content of the clicked item */
    onItemClick?: (level: number, key: string, content: T) => void;
    /** Optional callback function called when the multi-selection changes */
    onSelectionChange?: (paths: string[][]) => void;
    /** Optional function to render custom actions for file items. Receives the file content and the full path to the file as arguments */
    renderFileActions?: (file: T, path: string[]) => React.ReactNode;
    /** Optional function to render a preview for a selected file. Receives the file content and its path */
    renderFilePreview?: (file: T, path: string[]) => React.ReactNode;
}

/**
 * Props for the Column component
 */
interface ColumnProps<T> {
    /** The content to display in this column */
    content: T;
    /** The level (index) of this column */
    level: number;
    /** The currently selected path */
    selectedPath: string[];
    /** Currently multi-selected paths */
    multiSelectedPaths: string[][];
    /** Callback function when an item is clicked */
    onItemClick: (e: React.MouseEvent, level: number, key: string, content: T) => void;
    /** Optional function to render custom actions for file items */
    renderFileActions?: (file: T, path: string[]) => React.ReactNode;
}

interface SearchItem<T> {
    name: string;
    path: string[];
    displayPath: string;
    content: T;
    isDirectory: boolean;
    extension: string;
}

function checkIsDirectory(value: any): boolean {
    if (!value || typeof value !== 'object' || value instanceof Uint8Array) {
        return false;
    }
    return Object.keys(value).some(k => !k.startsWith('_'));
}

function getAllItems<T>(content: { [key: string]: T }, parentPath: string[] = []): SearchItem<T>[] {
    let items: SearchItem<T>[] = [];
    if (!content || typeof content !== 'object' || content instanceof Uint8Array) return items;

    for (const [key, value] of Object.entries(content)) {
        if (key.startsWith('_')) continue;
        const currentPath = [...parentPath, key];
        const isDir = checkIsDirectory(value);
        const name = key;
        const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';

        items.push({
            name,
            path: currentPath,
            displayPath: currentPath.join('/'),
            content: value,
            isDirectory: isDir,
            extension: ext,
        });

        if (isDir) {
            items = items.concat(getAllItems(value as any, currentPath));
        }
    }
    return items;
}

/**
 * A single column in the column view that displays a list of items.
 */
function Column<T>({
    content,
    level,
    selectedPath,
    multiSelectedPaths,
    onItemClick,
    renderFileActions
}: ColumnProps<T>): React.ReactElement {
    if (!content || typeof content !== 'object') {
        return (
            <div className="column-content">
                <div className="value">{String(content)}</div>
            </div>
        );
    }

    // Filter out internal properties that start with underscore
    const items = Object.entries(content).filter(([key]) => !key.startsWith('_'));

    return (
        <div className="column-content">
            {items.map(([key, value]) => {
                const isDirectory = checkIsDirectory(value);
                const currentPath = [...selectedPath.slice(0, level), key];
                const isSelected = selectedPath[level] === key ||
                    multiSelectedPaths.some(p => p.length === currentPath.length && p.every((seg, i) => seg === currentPath[i]));

                return (
                    <div
                        key={key}
                        className={`column-item ${isSelected ? 'selected' : ''} ${isDirectory ? 'has-children' : ''}`}
                        onClick={(e) => onItemClick(e, level, key, value)}
                        title={key}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}
                    >
                        <div className="item-name" style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                            {isDirectory ? (
                                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343" style={{ marginRight: '8px', flexShrink: 0 }}>
                                    <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z" />
                                </svg>
                            ) : null}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{key}</span>
                        </div>
                        {!isDirectory && renderFileActions && (
                            <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                                {renderFileActions(value, [...selectedPath.slice(0, level), key])}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * A reusable column-based file/directory viewer component.
 *
 * This component provides a column-based navigation interface similar to Finder or Explorer,
 * where each column represents a level in the directory hierarchy. Clicking on a directory
 * will open its contents in a new column to the right.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ColumnView
 *   initialContent={files}
 *   onItemClick={(level, key, content) => console.log(`Clicked ${key} at level ${level}`)}
 * />
 *
 * // With custom file actions
 * <ColumnView
 *   initialContent={files}
 *   renderFileActions={(file, path) => (
 *     <div className="file-actions">
 *       <button onClick={() => handleOpen(file)}>Open</button>
 *       <button onClick={() => handleDownload(file)}>Download</button>
 *     </div>
 *   )}
 * />
 * ```
 *
 * @component
 */
export function ColumnView<T>({
    initialContent,
    selectedPath: initialSelectedPath,
    onItemClick,
    onSelectionChange,
    renderFileActions,
    renderFilePreview,
}: ColumnViewProps<T>): React.ReactElement {
    const [selectedPath, setSelectedPath] = useState<string[]>([]);
    const [multiSelectedPaths, setMultiSelectedPaths] = useState<string[][]>([]);
    const [lastClickedItem, setLastClickedItem] = useState<{ level: number, key: string } | null>(null);
    const [isAltPressed, setIsAltPressed] = useState(false);
    const [columns, setColumns] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<{ content: any; path: string[] } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const columnsContainerRef = useRef<HTMLDivElement>(null);

    const allItems = useMemo(() => {
        return getAllItems(initialContent);
    }, [initialContent]);

    const filteredItems = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return [];
        return allItems.filter(item => {
            if (item.name.toLowerCase().includes(q)) return true;
            if (item.displayPath.toLowerCase().includes(q)) return true;
            if (item.extension && (item.extension === q || item.extension === '.' + q)) return true;
            return false;
        });
    }, [allItems, searchTerm]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey) setIsAltPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.altKey) setIsAltPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        if (initialSelectedPath && initialSelectedPath.length > 0) {
            const newColumns = [{ path: [], content: initialContent }];
            let currentContent: any = initialContent;
            let currentPath: string[] = [];

            for (const segment of initialSelectedPath) {
                if (currentContent && typeof currentContent === 'object' && segment in currentContent) {
                    currentPath = [...currentPath, segment];
                    currentContent = currentContent[segment];
                    const isDirectory = checkIsDirectory(currentContent);
                    if (isDirectory) {
                        newColumns.push({ path: currentPath, content: currentContent });
                    } else {
                        setSelectedFile({ content: currentContent, path: currentPath });
                    }
                } else {
                    break;
                }
            }
            setColumns(newColumns);
            setSelectedPath(currentPath);
        } else {
            setColumns([{ path: [], content: initialContent }]);
            setSelectedPath([]);
            setSelectedFile(null);
        }
    }, [initialContent, initialSelectedPath]);

    const handleItemClick = (e: React.MouseEvent, level: number, key: string, content: any) => {
        const newPath = [...selectedPath.slice(0, level), key];
        const isDirectory = checkIsDirectory(content);

        let newMultiSelected = [...multiSelectedPaths];

        if (e.shiftKey && lastClickedItem && lastClickedItem.level === level) {
            // Range selection in the same column
            const currentColumnContent = columns[level].content;
            const items = Object.keys(currentColumnContent).filter(k => !k.startsWith('_'));
            const startIdx = items.indexOf(lastClickedItem.key);
            const endIdx = items.indexOf(key);
            if (startIdx !== -1 && endIdx !== -1) {
                const rangeKeys = items.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
                const basePath = selectedPath.slice(0, level);
                const rangePaths = rangeKeys.map(k => [...basePath, k]);

                newMultiSelected = rangePaths;
            }
        } else if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            const pathStr = JSON.stringify(newPath);
            const exists = newMultiSelected.some(p => JSON.stringify(p) === pathStr);
            if (exists) {
                newMultiSelected = newMultiSelected.filter(p => JSON.stringify(p) !== pathStr);
            } else {
                newMultiSelected.push(newPath);
            }
        } else {
            // Regular click
            newMultiSelected = [newPath];
        }

        setMultiSelectedPaths(newMultiSelected);
        setLastClickedItem({ level, key });
        if (onSelectionChange) {
            onSelectionChange(newMultiSelected);
        }

        // If the same item is clicked again without modifiers, deselect it
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && JSON.stringify(newPath) === JSON.stringify(selectedPath)) {
            setSelectedPath(newPath.slice(0, -1)); // Go up one level
            setSelectedFile(null);
            setMultiSelectedPaths([]);
            if (onSelectionChange) {
                onSelectionChange([]);
            }
            setColumns(columns.slice(0, level + 1));
            return;
        }

        setSelectedPath(newPath);

        const newColumns = columns.slice(0, level + 1);
        if (isDirectory) {
            newColumns.push({ path: newPath, content });
            setSelectedFile(null); // Deselect file when a directory is clicked
        } else {
            setSelectedFile({ content, path: newPath });
        }
        setColumns(newColumns);

        setTimeout(() => {
            if (columnsContainerRef.current) {
                columnsContainerRef.current.scrollLeft = columnsContainerRef.current.scrollWidth;
            }
        }, 0);

        if (onItemClick) {
            onItemClick(level, key, content);
        }
    };

    const handleSearchResultClick = (item: SearchItem<T>) => {
        const isDir = item.isDirectory;
        const newPath = item.path;

        setSelectedPath(newPath);
        setMultiSelectedPaths([newPath]);

        // Reconstruct columns path for normal view when search is cleared
        const newColumns = [{ path: [], content: initialContent }];
        let currentContent: any = initialContent;
        let currentPath: string[] = [];

        for (const segment of newPath) {
            if (currentContent && typeof currentContent === 'object' && segment in currentContent) {
                currentPath = [...currentPath, segment];
                currentContent = currentContent[segment];
                const isSubDir = checkIsDirectory(currentContent);
                if (isSubDir) {
                    newColumns.push({ path: currentPath, content: currentContent });
                }
            } else {
                break;
            }
        }

        if (isDir) {
            setSelectedFile(null);
        } else {
            setSelectedFile({ content: item.content, path: newPath });
        }
        setColumns(newColumns);

        if (onSelectionChange) {
            onSelectionChange([newPath]);
        }
        if (onItemClick) {
            onItemClick(newPath.length - 1, item.name, item.content);
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden', height: '100%' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: '1px solid #ccc',
                backgroundColor: '#f9f9f9',
                gap: '8px',
                flexShrink: 0
            }}>
                <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#666">
                    <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-260q133 0 226.5-93.5T700-580q0-133-93.5-226.5T380-900q-133 0-226.5 93.5T60-580q0 133 93.5 226.5T380-260Z"/>
                </svg>
                <input
                    type="text"
                    className="search-input"
                    data-testid="column-search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search file names or types (e.g. .png, config)..."
                    style={{
                        flex: 1,
                        padding: '6px 10px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '13px',
                        outline: 'none'
                    }}
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        data-testid="column-search-clear"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#666',
                            padding: '2px 6px'
                        }}
                        title="Clear search"
                    >
                        ✕
                    </button>
                )}
                {searchTerm.trim() !== '' && (
                    <span className="search-count" data-testid="column-search-count" style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>
                        {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
                    </span>
                )}
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {searchTerm.trim() !== '' ? (
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                        <div
                            className="search-results-list"
                            data-testid="search-results-list"
                            style={{
                                flex: selectedFile && renderFilePreview ? '0 0 350px' : 1,
                                width: selectedFile && renderFilePreview ? '350px' : '100%',
                                borderRight: selectedFile && renderFilePreview ? '1px solid #ccc' : 'none',
                                overflowY: 'auto',
                                padding: '8px'
                            }}
                        >
                            {filteredItems.length === 0 ? (
                                <div style={{ padding: '16px', color: '#666', textAlign: 'center', fontSize: '14px' }}>
                                    No matching files or directories found.
                                </div>
                            ) : (
                                filteredItems.map((item) => {
                                    const isSelected = selectedPath.length === item.path.length &&
                                        item.path.every((seg, idx) => seg === selectedPath[idx]);
                                    return (
                                        <div
                                            key={item.displayPath}
                                            className={`search-result-item ${isSelected ? 'selected' : ''}`}
                                            data-path={item.displayPath}
                                            onClick={() => handleSearchResultClick(item)}
                                            style={{
                                                padding: '8px 10px',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backgroundColor: isSelected ? '#e0e0e0' : 'transparent',
                                                marginBottom: '2px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                                {item.isDirectory ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343" style={{ marginRight: '8px', flexShrink: 0 }}>
                                                        <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#666" style={{ marginRight: '8px', flexShrink: 0 }}>
                                                        <path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z"/>
                                                    </svg>
                                                )}
                                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                                                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                                                        {item.name}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {item.displayPath}
                                                    </span>
                                                </div>
                                            </div>
                                            {!item.isDirectory && renderFileActions && (
                                                <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                                                    {renderFileActions(item.content, item.path)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        {selectedFile && renderFilePreview && (
                            <div className="preview-pane" style={{
                                flex: 1,
                                height: '100%',
                                overflow: 'auto'
                            }}>
                                {renderFilePreview(selectedFile.content, selectedFile.path)}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="columns-container" ref={columnsContainerRef} style={{ display: 'flex', flex: 1, overflow: 'auto' }}>
                        {columns.map((column, index) => (
                            <div
                                key={index}
                                style={{
                                    width: '250px',
                                    minWidth: '250px',
                                    borderRight: '1px solid #ccc',
                                    overflow: 'auto',
                                    height: '100%'
                                }}
                            >
                                <Column
                                    content={column.content}
                                    level={index}
                                    selectedPath={selectedPath}
                                    multiSelectedPaths={multiSelectedPaths}
                                    onItemClick={handleItemClick}
                                    renderFileActions={renderFileActions}
                                />
                            </div>
                        ))}
                        {selectedFile && renderFilePreview && (
                            <div className="preview-pane" style={{
                                width: '700px',
                                minWidth: '700px',
                                height: '100%',
                                overflow: 'auto'
                            }}>
                                {renderFilePreview(selectedFile.content, selectedFile.path)}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>
                {`
                    *, *::before, *::after {
                        box-sizing: border-box;
                    }
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
                        user-select: ${isAltPressed ? 'text' : 'none'};
                    }
                    .column-item:hover {
                        background-color: #f0f0f0;
                    }
                    .column-item.selected {
                        background-color: #e0e0e0;
                    }
                    .search-result-item:hover {
                        background-color: #f0f0f0 !important;
                    }
                    .search-result-item.selected {
                        background-color: #e0e0e0 !important;
                    }
                    .file-actions {
                        display: flex;
                        gap: 4px;
                    }
                    .file-actions button {
                        padding: 4px;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .file-actions button:hover {
                        background-color: #f0f0f0;
                        border-radius: 4px;
                    }
                `}
            </style>
        </div>
    );
}
