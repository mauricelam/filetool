import React, { useState, useEffect, useRef } from 'react';

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
                // A directory is an object that has other entries as properties
                // A file is an object that has _name, _size, etc. properties
                const isDirectory = typeof value === 'object' &&
                    !(value instanceof Uint8Array) &&
                    Object.keys(value).some(k => !k.startsWith('_'));
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
    const [columns, setColumns] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<{ content: any; path: string[] } | null>(null);
    const columnsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialSelectedPath && initialSelectedPath.length > 0) {
            const newColumns = [{ path: [], content: initialContent }];
            let currentContent: any = initialContent;
            let currentPath: string[] = [];

            for (const segment of initialSelectedPath) {
                if (currentContent && typeof currentContent === 'object' && segment in currentContent) {
                    currentPath = [...currentPath, segment];
                    currentContent = currentContent[segment];
                    const isDirectory = typeof currentContent === 'object' &&
                        !(currentContent instanceof Uint8Array) &&
                        Object.keys(currentContent).some(k => !k.startsWith('_'));
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
        const isDirectory = typeof content === 'object' &&
            !(content instanceof Uint8Array) &&
            Object.keys(content).some(k => !k.startsWith('_'));

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

    return (
        <div style={{ flex: 1, display: 'flex', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden', height: '100%' }}>
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
                    }
                    .column-item:hover {
                        background-color: #f0f0f0;
                    }
                    .column-item.selected {
                        background-color: #e0e0e0;
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