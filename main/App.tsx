import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { HANDLERS, matchMimetype, getDefaultHandler, getHandlersForFileNameAndType } from 'file-type-detector';
import { FileItem } from "./fileitem";
import { TopBar } from './TopBar';
import { WASMagic, WASMagicFlags } from 'wasmagic';
import { IframeManager } from './IframeManager';
import { FileList } from './FileList';
import { PasteModal } from './PasteModal';
import ICON_LOOKUP from './icons';

export type HandlerConfig = {
    file: File,
    additionalFiles?: File[],
    magicMime: string,
    handler: string,
}

export interface AppFile {
    id: string;
    file: File;
    activeHandler?: HandlerConfig;
    pinnedHandlers: string[];
    parentId: string | null;
}

export interface AppGroup {
    id: string;
    name: string;
    fileIds: string[];
    activeHandler?: HandlerConfig;
    pinnedHandlers: string[];
    isExpanded: boolean;
}

export function App() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [files, setFiles] = useState<AppFile[]>([]);
    const [groups, setGroups] = useState<AppGroup[]>([]);
    const [pastedText, setPastedText] = useState<string | null>(null);

    const generateId = () => crypto.randomUUID();

    // Global paste handler
    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const files = Array.from(e.clipboardData?.items || [])
                .filter(item => item.kind === 'file')
                .map(item => item.getAsFile())
                .filter((file): file is File => file !== null);

            if (files.length > 0) {
                e.preventDefault();
                handleAddFiles(files);
                return;
            }

            const text = e.clipboardData?.getData('text/plain');
            if (text) {
                e.preventDefault();
                setPastedText(text);
                return;
            }
        };
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, []);

    const handleAddFiles = (newFiles: File[]) => {
        const newAppFiles: AppFile[] = newFiles.map(file => ({
            id: generateId(),
            file,
            pinnedHandlers: [],
            parentId: null
        }));
        setFiles(cur => [...cur, ...newAppFiles]);
        if (newAppFiles.length > 0) {
            setSelectedId(newAppFiles[newAppFiles.length - 1].id);
        }
    }

    const removeFile = (id: string) => {
        setFiles(cur => cur.filter(f => f.id !== id));
        setGroups(cur => cur.map(g => ({
            ...g,
            fileIds: g.fileIds.filter(fid => fid !== id)
        })).filter(g => g.fileIds.length > 0));

        if (selectedId === id) {
            setSelectedId(null);
        }
    };

    const toggleGroup = (id: string) => {
        setGroups(cur => cur.map(g => g.id === id ? { ...g, isExpanded: !g.isExpanded } : g));
    };

    const removeGroup = (id: string) => {
        setGroups(cur => cur.filter(g => g.id !== id));
        setFiles(cur => cur.map(f => f.parentId === id ? { ...f, parentId: null } : f));
        if (selectedId === id) {
            setSelectedId(null);
        }
    };

    const handleGroupFiles = (ids: string[]) => {
        if (ids.length < 1) return;
        const groupId = generateId();
        const firstFile = files.find(f => f.id === ids[0]);
        if (!firstFile) return;

        const newGroup: AppGroup = {
            id: groupId,
            name: ids.length > 1 ? `${firstFile.file.name} + ${ids.length - 1} others` : firstFile.file.name,
            fileIds: ids,
            pinnedHandlers: [],
            isExpanded: true
        };

        setGroups(cur => [
            ...cur.map(g => ({
                ...g,
                fileIds: g.fileIds.filter(fid => !ids.includes(fid))
            })).filter(g => g.fileIds.length > 0),
            newGroup
        ]);
        setFiles(cur => cur.map(f => ids.includes(f.id) ? { ...f, parentId: groupId } : f));
        setSelectedId(groupId);
    };

    useEffect(() => {
        const handleOpenFile = (e: CustomEvent<File[] | { file: File, additionalFiles?: File[], handler?: string }>) => {
            if (Array.isArray(e.detail)) {
                handleAddFiles(e.detail);
            } else {
                const { file, additionalFiles, handler } = e.detail;
                const fileId = crypto.randomUUID();

                const newFile: AppFile = {
                    id: fileId,
                    file,
                    activeHandler: handler ? {
                        file,
                        handler,
                        magicMime: file.type || 'application/octet-stream',
                        additionalFiles
                    } : undefined,
                    pinnedHandlers: [],
                    parentId: null
                };

                if (additionalFiles && additionalFiles.length > 0) {
                    const groupId = crypto.randomUUID();
                    const groupFiles: AppFile[] = additionalFiles.map(f => ({
                        id: crypto.randomUUID(),
                        file: f,
                        pinnedHandlers: [],
                        parentId: groupId
                    }));
                    newFile.parentId = groupId;

                    const newGroup: AppGroup = {
                        id: groupId,
                        name: `${file.name} + ${additionalFiles.length} others`,
                        fileIds: [fileId, ...groupFiles.map(f => f.id)],
                        activeHandler: newFile.activeHandler,
                        pinnedHandlers: [],
                        isExpanded: true
                    };

                    setFiles(cur => [...cur, newFile, ...groupFiles]);
                    setGroups(cur => [...cur, newGroup]);
                    setSelectedId(groupId);
                } else {
                    setFiles(cur => [...cur, newFile]);
                    setSelectedId(fileId);
                }
            }
        }
        window.addEventListener("openFiles", handleOpenFile as EventListener, false)
        return () => window.removeEventListener("openFiles", handleOpenFile as EventListener)
    }, []);

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state && event.state.fileName) {
                const file = files.find(f => f.file.name === event.state.fileName);
                if (file) {
                    setSelectedId(file.id);
                }
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [files]);

    const selectedFile = files.find(f => f.id === selectedId);
    const selectedGroup = groups.find(g => g.id === selectedId);

    const activeHandler = selectedFile?.activeHandler || selectedGroup?.activeHandler;

    return (
        <>
            <TopBar showToggle={files.length > 0} />
            {pastedText && (
                <PasteModal
                    text={pastedText}
                    onClose={() => setPastedText(null)}
                    onComplete={(file) => {
                        handleAddFiles([file]);
                        setPastedText(null);
                    }}
                />
            )}
            <div id="basicinfo">
                <div style={{ display: 'flex', height: '100%', width: '100%' }}>
                    <FileList
                        files={files}
                        groups={groups}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onRemoveFile={removeFile}
                        onRemoveGroup={removeGroup}
                        onAddFiles={handleAddFiles}
                        onGroupFiles={handleGroupFiles}
                        onToggleGroup={toggleGroup}
                    />
                    <div id="result" style={files.length > 0 ? { flexGrow: 1, padding: '8px', position: 'relative', overflow: 'auto' } : {}}>
                        {selectedFile &&
                            <LoadFileItem
                                key={selectedFile.id}
                                file={selectedFile.file}
                                openHandler={(handlerConfig: HandlerConfig) => {
                                    setFiles(cur => cur.map(f => f.id === selectedFile.id ? { ...f, activeHandler: handlerConfig } : f));
                                }}
                                initialActiveHandler={selectedFile.activeHandler}
                                pinnedHandlers={selectedFile.pinnedHandlers}
                                onAddPinnedHandler={(handlerId: string) => {
                                    setFiles(cur => cur.map(f => f.id === selectedFile.id ? {
                                        ...f,
                                        pinnedHandlers: f.pinnedHandlers.includes(handlerId) ? f.pinnedHandlers : [...f.pinnedHandlers, handlerId]
                                    } : f));
                                }}
                            />
                        }
                        {selectedGroup &&
                            <LoadGroupItem
                                key={selectedGroup.id}
                                group={selectedGroup}
                                files={files.filter(f => selectedGroup.fileIds.includes(f.id))}
                                openHandler={(handlerConfig: HandlerConfig) => {
                                    setGroups(cur => cur.map(g => g.id === selectedGroup.id ? { ...g, activeHandler: handlerConfig } : g));
                                }}
                                onAddPinnedHandler={(handlerId: string) => {
                                    setGroups(cur => cur.map(g => g.id === selectedGroup.id ? {
                                        ...g,
                                        pinnedHandlers: g.pinnedHandlers.includes(handlerId) ? g.pinnedHandlers : [...g.pinnedHandlers, handlerId]
                                    } : g));
                                }}
                            />
                        }
                    </div>
                </div>
            </div>
            <IframeManager activeHandler={activeHandler} files={files.map(f => f.file)} />
        </>
    );
}

interface LoadFileItemProps {
    file: File;
    openHandler: (handlerConfig: HandlerConfig) => void;
    initialActiveHandler?: HandlerConfig;
    pinnedHandlers: string[];
    onAddPinnedHandler: (handlerId: string) => void;
}

function LoadFileItem({ file, openHandler, initialActiveHandler, pinnedHandlers, onAddPinnedHandler }: LoadFileItemProps): ReactNode {
    const [handlers, setHandlers] = useState<any[]>([]);
    const [mime, setMime] = useState("");
    const [description, setDescription] = useState("Loading...");
    const [activeHandler, setActiveHandler] = useState<HandlerConfig | undefined>(initialActiveHandler);

    const magicPromise = WASMagic.create({
        flags: WASMagicFlags.NONE,
        stdio: (name, text) => console.log(text)
    });
    const mimeMagicPromise = WASMagic.create({
        flags: WASMagicFlags.MIME_TYPE,
        stdio: (name, text) => console.log(text)
    });

    useEffect(() => {
        const effect = async () => {
            const magic = await magicPromise;
            const mimeMagic = await mimeMagicPromise;
            const fileBuf = new Uint8Array(await file.arrayBuffer());
            const mime = mimeMagic.detect(fileBuf);
            const fileDescription = magic.detect(fileBuf);
            const handlers = getHandlersForFileNameAndType(file.name, mime, fileDescription);
            setMime(mime);
            setHandlers(handlers);
            setDescription(fileDescription);

            if (window.history.state?.fileName !== file.name) {
                window.history.pushState({ fileName: file.name }, file.name);
            }

            if (!initialActiveHandler) {
                const defaultHandlerId = getDefaultHandler(mime, file.name);
                if (defaultHandlerId) {
                    const defaultHandlerConfig = HANDLERS.find(h => h.handler === defaultHandlerId);
                    if (defaultHandlerConfig) {
                        const isMatch = defaultHandlerConfig.mimetypes.some(m => matchMimetype(m, mime, file.name));
                        if (isMatch) {
                            setTimeout(() => openHandler({ handler: defaultHandlerConfig.handler, file, magicMime: mime }), 0);
                        }
                    }
                }
            }
        }
        effect()
    }, [file]);

    const onOpenFile = (handlerConfig: HandlerConfig) => {
        openHandler(handlerConfig);
        setActiveHandler(handlerConfig);
        onAddPinnedHandler(handlerConfig.handler);
    }

    return (
        <FileItem
            key={file.name}
            file={file}
            name={file.name}
            mimetype={mime}
            description={description}
            matchedHandlers={handlers}
            allHandlers={HANDLERS}
            initialActiveHandler={activeHandler?.handler}
            pinnedHandlers={pinnedHandlers}
            onOpenHandler={onOpenFile}
        />
    )
}

interface LoadGroupItemProps {
    group: AppGroup;
    files: AppFile[];
    openHandler: (handlerConfig: HandlerConfig) => void;
    onAddPinnedHandler: (handlerId: string) => void;
}

function LoadGroupItem({ group, files, openHandler, onAddPinnedHandler }: LoadGroupItemProps): ReactNode {
    const [activeHandler, setActiveHandler] = useState<HandlerConfig | undefined>(group.activeHandler);
    const [isOtherHandlersDialogOpen, setOtherHandlersDialogOpen] = useState(false);
    const [otherHandlersFilter, setOtherHandlersFilter] = useState('');
    const [groupMimetypes, setGroupMimetypes] = useState<string[]>([]);

    const mimeMagicPromise = WASMagic.create({
        flags: WASMagicFlags.MIME_TYPE,
        stdio: (name, text) => console.log(text)
    });

    useEffect(() => {
        const loadMimes = async () => {
            const mimeMagic = await mimeMagicPromise;
            const mimes = await Promise.all(files.map(async f => {
                const fileBuf = new Uint8Array(await f.file.arrayBuffer());
                return mimeMagic.detect(fileBuf);
            }));
            setGroupMimetypes(Array.from(new Set(mimes)));
        };
        loadMimes();
    }, [files]);

    const onOpenFile = (handlerConfig: HandlerConfig) => {
        openHandler(handlerConfig);
        setActiveHandler(handlerConfig);
        onAddPinnedHandler(handlerConfig.handler);
    }

    const isUniversal = (handler: any) => handler.mimetypes.length === 1 && handler.mimetypes[0] === matchMimetype({}, '', ''); // Approximation

    const matchesGroup = (handler: any) => {
        // A handler matches a group if it matches any file in the group
        return files.some((f, idx) => {
            const mime = groupMimetypes[idx] || f.file.type || 'application/octet-stream';
            return handler.mimetypes.some((m: any) => matchMimetype(m, mime, f.file.name));
        });
    };

    // Dex viewer and Archive are special.
    // Archive should always be available for groups.
    // Dex viewer only if dex files are present.
    const promotedHandlers = HANDLERS.filter(h => {
        if (h.handler === 'archive') return true;
        if (h.handler === 'dexviewer') return matchesGroup(h);
        return false;
    });

    const filteredHandlers = HANDLERS.filter(h => {
        const filter = otherHandlersFilter.toLowerCase();
        return h.name.toLowerCase().includes(filter) || h.handler.toLowerCase().includes(filter);
    });

    const buttonStyle: React.CSSProperties = {
        padding: '10px 20px',
        borderRadius: '4px',
        border: '1px solid #0066cc',
        backgroundColor: '#fff',
        color: '#0066cc',
        cursor: 'pointer',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px'
    };

    const activeButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        backgroundColor: '#0066cc',
        border: '1px solid #0066cc',
        color: '#fff',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '11px',
        color: '#666',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginRight: '8px',
    };

    return (
        <div style={{ display: 'flex', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#666" style={{ flexShrink: 0 }}>
                <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Z" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{group.name}</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                        color: '#fff',
                        padding: '1px 4px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        backgroundColor: '#666',
                        marginRight: '4px',
                        userSelect: 'none',
                    }}>group</div>
                    <span style={{ color: '#555', fontSize: '14px' }}>{files.length} files</span>
                </div>

                <div className="buttonBar" style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                    <label style={labelStyle}>Open with:</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                        {(() => {
                            const allVisibleGroupHandlers = [
                                ...promotedHandlers,
                                ...HANDLERS.filter(h => group.pinnedHandlers.includes(h.handler))
                            ].filter((h, i, self) => self.findIndex(t => t.handler === h.handler) === i);

                            return (
                                <>
                                    {allVisibleGroupHandlers.map(handler => (
                                        <button
                                            key={handler.handler}
                                            onClick={() => onOpenFile({
                                                file: files[0].file,
                                                additionalFiles: files.slice(1).map(f => f.file),
                                                handler: handler.handler,
                                                magicMime: 'application/octet-stream'
                                            })}
                                            style={activeHandler?.handler === handler.handler ? activeButtonStyle : buttonStyle}
                                        >
                                            {handler.name.replace(/^Open with /i, '').replace(/^Open in /i, '')}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setOtherHandlersDialogOpen(true)}
                                        style={{
                                            ...buttonStyle,
                                            backgroundColor: '#f0f0f0',
                                            color: '#555',
                                            border: '1px solid #ccc',
                                            padding: '6px 12px'
                                        }}
                                        title="Other handlers"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                                            <path d="M240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400Z" />
                                        </svg>
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </div>

            {isOtherHandlersDialogOpen && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 1000
                    }}
                    onClick={() => setOtherHandlersDialogOpen(false)}
                >
                    <div
                        style={{
                            background: 'white', padding: '20px', borderRadius: '8px',
                            width: '80%', maxWidth: '600px', maxHeight: '80vh',
                            overflowY: 'auto', position: 'relative'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setOtherHandlersDialogOpen(false)}
                            style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                        >×</button>
                        <h2>All Handlers</h2>
                        <input
                            type="text"
                            placeholder="Filter by name..."
                            value={otherHandlersFilter}
                            onChange={(e) => setOtherHandlersFilter(e.target.value)}
                            style={{ width: '100%', padding: '8px', marginBottom: '15px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                            {filteredHandlers.map(handler => (
                                <button
                                    key={handler.handler}
                                    onClick={() => {
                                        onOpenFile({
                                            file: files[0].file,
                                            additionalFiles: files.slice(1).map(f => f.file),
                                            handler: handler.handler,
                                            magicMime: 'application/octet-stream'
                                        });
                                        setOtherHandlersDialogOpen(false);
                                    }}
                                    style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    {handler.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            </div>
        </div>
    );
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