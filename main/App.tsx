import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { HANDLERS, matchMimetype, getDefaultHandler, getHandlersForFileNameAndType } from 'file-type-detector';
import { FileItem, FileListItem } from "./fileitem";
import { TopBar } from './TopBar';
import { DropTarget } from './DropTarget';
import { WASMagic, WASMagicFlags } from 'wasmagic';
import { processDataTransferItems } from './utils';
import { IframeManager, IframeManagerHandle } from './IframeManager';

export function App() {
    const [magic, setMagic] = useState<WASMagic | null>(null);
    const [mimeMagic, setMimeMagic] = useState<WASMagic | null>(null);
    const [selected, setSelected] = useState(0)
    const [files, setFiles] = useState<File[]>([])
    const [isDragging, setIsDragging] = useState(false);
    const [isAddFileHovered, setAddFileHovered] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const iframeManagerRef = useRef<IframeManagerHandle>(null);

    useEffect(() => {
        const magic = WASMagic.create({
            flags: WASMagicFlags.NONE,
            stdio: (name, text) => console.log(text)
        });
        const mimeMagic = WASMagic.create({
            flags: WASMagicFlags.MIME_TYPE,
            stdio: (name, text) => console.log(text)
        });

        Promise.all([magic, mimeMagic]).then(([magic, mimeMagic]) => {
            setMagic(magic);
            setMimeMagic(mimeMagic);
        });
    }, []);

    const openHandler = (handler: string, file: File, mime: string) => {
        iframeManagerRef.current?.openHandler(handler, file, mime);
    };

    const handleAddFiles = (newFiles: File[]) => {
        setFiles(cur => {
            const updatedFiles = [...cur, ...newFiles];
            setSelected(updatedFiles.length > 0 ? updatedFiles.length - 1 : 0);
            return updatedFiles;
        });
    }

    const removeFile = (index: number) => {
        setFiles(cur => {
            const newFiles = [...cur];
            newFiles.splice(index, 1);
            if (selected >= newFiles.length) {
                return newFiles;
            }
            return newFiles;
        });
        setSelected(prev => Math.min(prev, files.length - 2));
    };

    // Correct selection clamping when files change
    useEffect(() => {
        if (files.length > 0 && selected >= files.length) {
            setSelected(files.length - 1);
        }
    }, [files.length, selected]);


    // Handle Drop on Sidebar
    const onSidebarDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        setIsDragging(false);
        e.preventDefault();

        const files = await processDataTransferItems(e.dataTransfer!.items);
        handleAddFiles(files);
    }

    useEffect(() => {
        const handleOpenFile = (e: CustomEvent<File[]>) => {
            handleAddFiles(e.detail);
        }
        window.addEventListener("openFiles", handleOpenFile as EventListener, false)
        return () => window.removeEventListener("openFiles", handleOpenFile as EventListener)
    }, [])

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state && event.state.fileName) {
                const fileIndex = files.findIndex(f => f.name === event.state.fileName);
                if (fileIndex !== -1) {
                    setSelected(fileIndex);
                }
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [files]);

    function LoadFileItem({ file }: { file: File }): ReactNode {
        const [handlers, setHandlers] = useState<any[]>([]);
        const [mime, setMime] = useState("");
        const [description, setDescription] = useState("Loading...");

        useEffect(() => {
            const fun = async () => {
                if (!magic || !mimeMagic) return;
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

                const defaultHandlerId = getDefaultHandler(mime, file.name);
                if (defaultHandlerId) {
                    const defaultHandlerConfig = HANDLERS.find(h => h.handler === defaultHandlerId);
                    if (defaultHandlerConfig) {
                        const isMatch = defaultHandlerConfig.mimetypes.some(m => matchMimetype(m, mime, file.name));
                        if (isMatch) {
                            setTimeout(() => openHandler(defaultHandlerConfig.handler, file, mime), 0);
                        }
                    }
                }
            }
            fun()
        }, [file]);

        const defaultHandler = getDefaultHandler(mime, file.name);
        return (
            <FileItem
                key={file.name}
                file={file}
                name={file.name}
                mimetype={mime}
                description={description}
                matchedHandlers={handlers}
                allHandlers={HANDLERS}
                initialActiveHandler={defaultHandler}
                onOpenHandler={(handlerId, filename, mimetype) => {
                    openHandler(handlerId, file, mimetype);
                }}
            />
        )
    }

    if (!magic || !mimeMagic) {
        return (
            <div style={{ padding: 20 }}>
                Loading WASMagic...
            </div>
        );
    }

    return (
        <>
            <TopBar showToggle={files.length > 0} />
            <div id="basicinfo">
                {files.length === 0 ? (
                    <>
                        <DropTarget onFiles={handleAddFiles} />
                        <div id="result"></div>
                    </>
                ) : (
                    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
                        <div style={{
                            width: '200px',
                            borderRight: '1px solid #ccc',
                            padding: '8px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexShrink: 0,
                            flexDirection: 'column',
                            backgroundColor: isDragging ? '#e6f3ff' : 'transparent'
                        }}
                            onDrop={onSidebarDrop}
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
                                        onClick={() => setSelected(index)}
                                        onRemove={() => removeFile(index)}
                                    />
                                ))}
                            </div>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onMouseEnter={() => setAddFileHovered(true)}
                                onMouseLeave={() => setAddFileHovered(false)}
                                style={{
                                    marginTop: '8px',
                                    padding: '8px',
                                    textAlign: 'center',
                                    border: `1px dashed ${isAddFileHovered ? '#0066cc' : '#ccc'}`,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    backgroundColor: isAddFileHovered ? '#e6f3ff' : 'transparent'
                                }}
                            >
                                Add file
                            </div>
                            <input
                                type="file"
                                style={{ display: 'none' }}
                                multiple
                                ref={fileInputRef}
                                onChange={(e) => e.target.files && handleAddFiles(Array.from(e.target.files))}
                            />
                        </div>
                        <div id="result" style={{ flexGrow: 1, padding: '8px', position: 'relative', overflow: 'auto' }}>
                            {files[selected] && <LoadFileItem key={selected} file={files[selected]} />}
                        </div>
                    </div>
                )}
            </div>
            <IframeManager ref={iframeManagerRef} activeFile={files[selected]} />
        </>
    );
}
