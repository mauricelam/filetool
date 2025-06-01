import React, { useState, useEffect, useRef } from 'react';

/**
 * Props for the ColumnView component
 * @interface ColumnViewProps
 */
interface ColumnViewProps {
    /** The initial content to display in the column view. Should be an object where keys are item names and values are either nested objects (for directories) or any other type (for files) */
    initialContent: { [key: string]: any };
    /** Optional callback function that is called when an item is clicked. Receives the level (column index), key (item name), and content of the clicked item */
    onItemClick?: (level: number, key: string, content: any) => void;
    /** Optional function to render custom actions for file items. Receives the file content and the full path to the file as arguments */
    renderFileActions?: (file: any, path: string[]) => React.ReactNode;
    /** Optional path to highlight/select automatically within the ColumnView */
    highlightPath?: string | null;
    /** Optional callback to signal that the highlight operation is complete */
    onHighlightDone?: () => void;
}

/**
 * Props for the Column component
 * @interface ColumnProps
 */
interface ColumnProps {
    /** The content to display in this column */
    content: any;
    /** The level (index) of this column */
    level: number;
    /** The currently selected path */
    selectedPath: string[];
    /** Callback function when an item is clicked */
    onItemClick: (level: number, key: string, content: any) => void;
    /** Optional function to render custom actions for file items */
    renderFileActions?: (file: any, path: string[]) => React.ReactNode;
}

/**
 * A single column in the column view that displays a list of items.
 * 
 * @component
 * @param {ColumnProps} props - The component props
 * @returns {React.ReactElement} A column displaying a list of items
 */
const Column: React.FC<ColumnProps> = ({
    content,
    level,
    selectedPath,
    onItemClick,
    renderFileActions
}) => {
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
                const isSelected = selectedPath[level] === key;

                return (
                    <div
                        key={key}
                        className={`column-item ${isSelected ? 'selected' : ''} ${isDirectory ? 'has-children' : ''}`}
                        onClick={() => onItemClick(level, key, value)}
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
};

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
 * @param {ColumnViewProps} props - The component props
 * @returns {React.ReactElement} A column-based file/directory viewer
 */
export const ColumnView: React.FC<ColumnViewProps> = ({
    initialContent,
    onItemClick,
    renderFileActions,
    highlightPath,
    onHighlightDone,
}) => {
    const [selectedPath, setSelectedPath] = useState<string[]>([]);
    const [columns, setColumns] = useState<any[]>([]);
    const columnsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initialize with root content
        setColumns([{ path: [], content: initialContent }]);
        // If there's an initial highlight path, reset selectedPath to empty
        // to ensure the highlight logic can take over.
        if (highlightPath) {
            setSelectedPath([]);
        }
    }, [initialContent]); // highlightPath is intentionally not in deps here to avoid loop with below effect

    useEffect(() => {
        if (highlightPath) {
            console.log("Highlighting path:", highlightPath);
            const segments = highlightPath.split('/').filter(s => s);
            let currentContent = initialContent;
            const newSelectedPath: string[] = [];
            const newColumns = [{ path: [], content: initialContent }];
            let pathFound = true;

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                if (currentContent && typeof currentContent === 'object' && segment in currentContent) {
                    newSelectedPath.push(segment);
                    const itemContent = currentContent[segment];
                    const isDirectory = typeof itemContent === 'object' &&
                        !(itemContent instanceof Uint8Array) &&
                        Object.keys(itemContent).some(k => !k.startsWith('_'));

                    if (isDirectory || i === segments.length - 1) { // If it's a directory or the last segment (file)
                        newColumns.push({ path: [...newSelectedPath], content: itemContent });
                    }
                    currentContent = itemContent;
                } else {
                    console.error(`Path segment not found: ${segment} in ${highlightPath}`);
                    pathFound = false;
                    break;
                }
            }

            if (pathFound) {
                setSelectedPath(newSelectedPath);
                // If the last segment is a file, we might not want to "open" it as a new column.
                // The newColumns up to the parent directory of the file should be set.
                // If the target is a file, the last entry in newColumns is the file itself.
                // We actually want to display its parent's content in the last column,
                // and the file itself will be selected.

                // If the target (last segment) is not a directory, remove it from columns to show its parent
                const finalSegmentContent = newSelectedPath.reduce((acc, seg) => acc?.[seg], initialContent);
                const isFinalSegmentDirectory = typeof finalSegmentContent === 'object' &&
                    !(finalSegmentContent instanceof Uint8Array) &&
                    Object.keys(finalSegmentContent).some(k => !k.startsWith('_'));

                if (!isFinalSegmentDirectory && newColumns.length > 1 && newColumns[newColumns.length-1].path.join('/') === newSelectedPath.join('/')) {
                     // If the very last item in newColumns is the file itself (not a dir), pop it.
                     // We want to show the parent directory of the file.
                     // However, the logic above already correctly forms newColumns up to the item itself.
                     // If the item is a file, its content will be shown in the Column component's "value" div.
                     // If it's a directory, its items will be listed.
                     // So, current newColumns structure should be fine.
                }
                setColumns(newColumns);


                // Scroll to the right
                setTimeout(() => {
                    if (columnsContainerRef.current) {
                        columnsContainerRef.current.scrollLeft = columnsContainerRef.current.scrollWidth;
                    }
                }, 0);
            }

            if (onHighlightDone) {
                onHighlightDone();
            }
        }
    }, [highlightPath, initialContent, onHighlightDone]); // Added initialContent and onHighlightDone

    const handleItemClick = (level: number, key: string, content: any) => {
        const newPath = [...selectedPath.slice(0, level), key];
        setSelectedPath(newPath);

        // Only add a new column if the clicked item is a directory
        const isDirectory = typeof content === 'object' && 
            !(content instanceof Uint8Array) && 
            Object.keys(content).some(k => !k.startsWith('_'));

        const newColumns = columns.slice(0, level + 1);
        if (isDirectory) {
            newColumns.push({ path: newPath, content });
        }
        setColumns(newColumns);

        // Scroll to the right after the new column is added
        if (isDirectory) {
            setTimeout(() => {
                if (columnsContainerRef.current) {
                    columnsContainerRef.current.scrollLeft = columnsContainerRef.current.scrollWidth;
                }
            }, 0);
        }

        // Call the parent's onItemClick if provided
        if (onItemClick) {
            onItemClick(level, key, content);
        }
    };

    return (
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
                        <Column
                            content={column.content}
                            level={index}
                            selectedPath={selectedPath}
                            onItemClick={handleItemClick}
                            renderFileActions={renderFileActions}
                        />
                    </div>
                ))}
            </div>
            <style>
                {`
                    *, *::before, *::after {
                        box-sizing: border-box;
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
}; 