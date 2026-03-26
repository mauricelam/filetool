import React, { CSSProperties, ReactElement, useEffect, useState, useRef } from "react";
import CustomTypesRaw from "./mime-db/custom-types.json";
const CustomTypes = CustomTypesRaw as Record<string, MimeDbItem>;
import IanaTypesRaw from "./mime-db/iana-types.json";
const IanaTypes = IanaTypesRaw as Record<string, MimeDbItem>;
import { setDefaultHandler, getDefaultHandler, HandlerDefinition, isAnyMimeMatch, MIME_MATCH_ANY } from 'file-type-detector';
import ICON_LOOKUP from './icons';
import { HandlerConfig } from "./App";

interface MimeDbItem {
    compressible?: boolean,
    extensions?: string[],
    sources?: string[],
}

function cleanHandlerName(name: string) {
    return name.replace(/^Open with /i, '').replace(/^Open in /i, '');
}

function getIcon(name: string) {
    for (const ext in ICON_LOOKUP) {
        const key = ext as keyof typeof ICON_LOOKUP
        if (name.toLowerCase().endsWith("." + ext) || name.toLowerCase() == ext) {
            return `icons/file_type_${ICON_LOOKUP[key][0]}.svg`
        }
    }
    return `icons/default_file.svg`
}

const StarFilled = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#FFC107">
        <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z" />
    </svg>
);

const StarOutline = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
        <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-135-58 135-146 13 111 97-33 142ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z" />
    </svg>
);

const MoreIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
        <path d="M240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400Z" />
    </svg>
);

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
        <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
    </svg>
);

interface FileItemProps {
    file: File;
    name: string;
    mimetype: string;
    description: string;
    matchedHandlers: HandlerDefinition[];
    allHandlers: HandlerDefinition[];
    pinnedHandlers: string[];
    onOpenHandler: (handlerConfig: HandlerConfig) => void;
    initialActiveHandler?: string;
}

export function FileItem(
    { file, name, mimetype, description, matchedHandlers, allHandlers, pinnedHandlers, onOpenHandler, initialActiveHandler }: FileItemProps
) {
    const [isOtherHandlersDialogOpen, setOtherHandlersDialogOpen] = useState(false);
    const [otherHandlersFilter, setOtherHandlersFilter] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const filterInputRef = useRef<HTMLInputElement>(null);
    const otherButtonRef = useRef<HTMLButtonElement>(null);

    const isUniversal = (handler: HandlerDefinition) => handler.mimetypes.length === 1 && handler.mimetypes[0] === MIME_MATCH_ANY;
    const universalHandlers = allHandlers.filter(isUniversal);

    const matchesFilter = (handler: HandlerDefinition) => {
        const filter = otherHandlersFilter.toLowerCase();
        if (!filter) return true;

        const nameMatch = handler.name.toLowerCase().includes(filter);
        const mimeMatch = handler.mimetypes.some(m => {
            if (typeof m === 'string') {
                return m.toLowerCase().includes(filter);
            } else if (m instanceof RegExp) {
                return m.source.toLowerCase().includes(filter);
            } else if (typeof m === 'object' && m.filename instanceof RegExp) {
                return m.filename.source.toLowerCase().includes(filter)
            }
            return false;
        });

        return nameMatch || mimeMatch;
    };

    const filteredUniversalHandlers = universalHandlers.filter(matchesFilter);
    const filteredTypeSpecificHandlers = allHandlers
        .filter(handler => !isUniversal(handler))
        .filter(matchesFilter);

    const allVisibleHandlers = [...filteredUniversalHandlers, ...filteredTypeSpecificHandlers];

    const currentDefaultHandlerId = getDefaultHandler(mimetype, name) || null;
    const [activeHandlerId, setActiveHandlerId] = useState<string | null>(initialActiveHandler || null);
    const [localDefaultHandlerId, setLocalDefaultHandlerId] = useState<string | null>(currentDefaultHandlerId);

    // Set initial active handler if provided
    useEffect(() => {
        if (initialActiveHandler) {
            setActiveHandlerId(initialActiveHandler);
        }
    }, [initialActiveHandler]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOtherHandlersDialogOpen(false);
            }
        };

        if (isOtherHandlersDialogOpen) {
            document.addEventListener('keydown', handleKeyDown);
            filterInputRef.current?.focus();
            setSelectedIndex(0);
        } else {
            otherButtonRef.current?.focus();
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOtherHandlersDialogOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [otherHandlersFilter]);

    const handleFilterKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % allVisibleHandlers.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + allVisibleHandlers.length) % allVisibleHandlers.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const handler = allVisibleHandlers[selectedIndex];
            if (handler) {
                onOpenHandler({ handler: handler.handler, file, magicMime: mimetype });
                setOtherHandlersDialogOpen(false);
            }
        }
    };

    const labelStyle: CSSProperties = {
        color: '#fff',
        padding: '1px 4px',
        fontSize: '12px',
        borderRadius: '6px',
        backgroundColor: '#666',
        marginRight: '2px',
        userSelect: 'none',
    }

    const buttonStyle: CSSProperties = {
        marginRight: '5px',
        padding: '6px 12px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        backgroundColor: '#fff',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s ease',
    }

    const promotedButtonStyle: CSSProperties = {
        ...buttonStyle,
        border: '1px solid #0066cc',
        color: '#0066cc',
    }

    const demotedButtonStyle: CSSProperties = {
        ...buttonStyle,
        backgroundColor: '#f0f0f0',
        color: '#555',
        border: '1px solid #ccc',
    }

    const activeButtonStyle: CSSProperties = {
        ...promotedButtonStyle,
        backgroundColor: '#0066cc',
        border: '1px solid #0066cc',
        color: '#fff',
    }

    const defaultIndicatorStyle: CSSProperties = {
        fontSize: '11px',
        color: '#666',
        textAlign: 'center',
        marginTop: '2px',
        fontStyle: 'italic',
    }

    const icon = getIcon(name)
    const [mimeDetails, setMimeDetails] = useState<ReactElement>()
    async function showMimeDetails() {
        const sources = (IanaTypes[mimetype] || CustomTypes[mimetype])?.sources
        setMimeDetails(current => {
            if (current) {
                return undefined
            } else {
                if (!sources) {
                    return <div>Cannot find further information about this mimetype</div>
                }
                return (
                    <div style={{ backgroundColor: '#ddd', padding: 4, borderRadius: 4 }}>
                        {sources.map(source => (
                            <a key={source} style={{ display: 'block', fontSize: 16 }} href={source} target="_blank">{source}</a>
                        ))}
                    </div>
                )
            }
        })
    }
    return (
        <div style={{ display: 'flex' }}>
            <img src={icon} style={{ width: 32, height: 32, marginRight: 4 }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="filename">{name}</div>
                <div>
                    <label style={labelStyle}>mimetype</label>
                    <span className="mime" style={{ color: '#555', fontSize: '14px' }}>{mimetype}</span>
                    <a href="#" onClick={() => { showMimeDetails(); return false }}>
                        <svg style={{ margin: '0 4px' }} xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#434343"><path d="M200-800v241-1 400-640 200-200Zm80 400h140q9-23 22-43t30-37H280v80Zm0 160h127q-5-20-6.5-40t.5-40H280v80ZM200-80q-33 0-56.5-23.5T120-160v-640q0-33 23.5-56.5T200-880h320l240 240v100q-19-8-39-12.5t-41-6.5v-41H480v-200H200v640h241q16 24 36 44.5T521-80H200Zm460-120q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29ZM864-40 756-148q-21 14-45.5 21t-50.5 7q-75 0-127.5-52.5T480-300q0-75 52.5-127.5T660-480q75 0 127.5 52.5T840-300q0 26-7 50.5T812-204L920-96l-56 56Z" /></svg>
                    </a>
                    {mimeDetails}
                    <div></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'start' }}>
                    <label style={labelStyle}>description</label>
                    <span className="filedescription" style={{ fontSize: '14px' }}>{description}</span>
                </div>
                <div className="buttonBar" style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                    <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginRight: '8px' }}>Open with:</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                        {(() => {
                            const specificHandlers = matchedHandlers.filter(h => !isUniversal(h));
                            const baseHandlers = specificHandlers.length > 0
                                ? specificHandlers
                                : allHandlers.filter(h => h.handler === 'hex_viewer');

                            return [...baseHandlers,
                            ...allHandlers.filter(h => pinnedHandlers.includes(h.handler) || h.handler === activeHandlerId)]
                                .filter((handler, index, self) =>
                                    index === self.findIndex((t) => t.handler === handler.handler)
                                )
                                .sort((a, b) => {
                                    // Sort active handler to the front
                                    if (a.handler === activeHandlerId) return -1;
                                    if (b.handler === activeHandlerId) return 1;
                                    return 0;
                                })
                                .map(handlerConfig => {
                                    const isCurrentDefault = handlerConfig.handler === localDefaultHandlerId;
                                    const isActive = handlerConfig.handler === activeHandlerId;
                                    let style = isAnyMimeMatch(handlerConfig.mimetypes) ? demotedButtonStyle : promotedButtonStyle;
                                    if (isActive) {
                                        style = activeButtonStyle;
                                    }

                                    return (
                                        <div key={handlerConfig.handler} style={{ marginRight: '10px', display: 'inline-block', marginBottom: '5px' }}>
                                            <button
                                                onClick={() => {
                                                    setActiveHandlerId(handlerConfig.handler);
                                                    onOpenHandler({ handler: handlerConfig.handler, file, magicMime: mimetype });
                                                }}
                                                style={style}
                                            >
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newDefault = isCurrentDefault ? null : handlerConfig.handler;
                                                        setDefaultHandler(mimetype, name, newDefault);
                                                        setLocalDefaultHandlerId(newDefault);
                                                    }}
                                                    style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                                                    title={isCurrentDefault ? "Remove as default handler" : "Set as default handler"}
                                                >
                                                    {isCurrentDefault ? <StarFilled /> : <StarOutline />}
                                                </span>
                                                {cleanHandlerName(handlerConfig.name)}
                                            </button>
                                        </div>
                                    );
                                });
                        })()}
                        <div style={{ marginRight: '10px', display: 'inline-block', marginBottom: '5px' }}>
                            <button
                                ref={otherButtonRef}
                                onClick={() => setOtherHandlersDialogOpen(true)}
                                style={demotedButtonStyle}
                                title="Other handlers"
                            >
                                <MoreIcon />
                            </button>
                        </div>
                        <div style={{ marginRight: '10px', display: 'inline-block', marginBottom: '5px' }}>
                            <button
                                onClick={() => {
                                    const url = URL.createObjectURL(file);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = file.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                }}
                                style={demotedButtonStyle}
                                title="Download"
                            >
                                <DownloadIcon />
                            </button>
                        </div>
                    </div>
                </div>
                {isOtherHandlersDialogOpen && (
                    <div className="other-handlers-dialog-overlay" onClick={() => setOtherHandlersDialogOpen(false)}>
                        <div
                            className="other-handlers-dialog"
                            onClick={e => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                        >
                            <button
                                className="close-button"
                                onClick={() => setOtherHandlersDialogOpen(false)}
                                aria-label="Close"
                            >×</button>
                            <h2>All Handlers</h2>
                            <input
                                ref={filterInputRef}
                                type="text"
                                placeholder="Filter by name, mime, or extension"
                                value={otherHandlersFilter}
                                onChange={(e) => setOtherHandlersFilter(e.target.value)}
                                onKeyDown={handleFilterKeyDown}
                                className="filter-input"
                            />
                            {filteredUniversalHandlers.length > 0 && (
                                <>
                                    <h3 className="handler-section-title">Universal Handlers</h3>
                                    <div className="handlers-grid">
                                        {filteredUniversalHandlers.map((handler, index) => (
                                            <button
                                                key={handler.handler}
                                                onClick={() => {
                                                    onOpenHandler({ handler: handler.handler, file, magicMime: mimetype });
                                                    setOtherHandlersDialogOpen(false);
                                                }}
                                                className={`handler-button ${selectedIndex === index ? 'selected' : ''}`}
                                            >
                                                {handler.name}
                                            </button>
                                        ))}
                                    </div>
                                    <hr />
                                </>
                            )}
                            <div className="handlers-grid">
                                {filteredTypeSpecificHandlers.map((handler, index) => {
                                    const overallIndex = index + filteredUniversalHandlers.length;
                                    return (
                                        <button
                                            key={handler.handler}
                                            onClick={() => {
                                                onOpenHandler({ handler: handler.handler, file, magicMime: mimetype });
                                                setOtherHandlersDialogOpen(false);
                                            }}
                                            className={`handler-button ${selectedIndex === overallIndex ? 'selected' : ''}`}
                                        >
                                            {handler.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style>
                {`
                    .circle-container {
                        opacity: 0.2;
                        cursor: pointer;
                    }
                    .circle-container:hover {
                        opacity: 1;
                    }
                    .other-handlers-dialog-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                    }
                    .other-handlers-dialog {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        width: 80%;
                        max-width: 600px;
                        max-height: 80vh;
                        overflow-y: auto;
                        position: relative;
                    }
                    .close-button {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: transparent;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                    }
                    .filter-input {
                        width: 100%;
                        box-sizing: border-box;
                        padding: 8px;
                        margin-bottom: 15px;
                        border: 1px solid #ccc;
                        border-radius: 4px;
                    }
                    .handlers-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                        gap: 10px;
                    }
                    .handler-button {
                        padding: 10px;
                        border: 1px solid #ccc;
                        border-radius: 4px;
                        background-color: #f0f0f0;
                        cursor: pointer;
                        text-align: center;
                        font-size: 14px;
                    }
                    .handler-button:hover {
                        background-color: #e0e0e0;
                    }
                    .handler-button.selected {
                        background-color: #e6f3ff;
                        border-color: #0066cc;
                        box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
                    }
                `}
            </style>
        </div>
    )
}

export function FileListItem(
    { file, selected, multiSelected, isDragOver, onClick, onRemove }: { file: File, selected: boolean, multiSelected?: boolean, isDragOver?: boolean, onClick: (e: React.MouseEvent) => void, onRemove: () => void }
) {
    const [isHovered, setHovered] = useState(false);
    const icon = getIcon(file.name);
    return (
        <div
            className="file-list-item"
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                cursor: 'pointer',
                backgroundColor: isDragOver ? '#d1e9ff' : (selected || multiSelected ? '#e6f3ff' : (isHovered ? '#f0f0f0' : 'transparent')),
                border: selected ? '1px solid #0066cc' : (isDragOver ? '1px dashed #0066cc' : '1px solid transparent'),
                borderRadius: '4px',
                justifyContent: 'space-between'
            }}>
            <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                <img src={icon} style={{ width: 24, height: 24, marginRight: 8, flexShrink: 0 }} />
                <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '13px'
                }}>{file.name}</span>
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
