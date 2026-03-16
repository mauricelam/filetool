import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { HANDLERS, matchMimetype, getDefaultHandler, getHandlersForFileNameAndType } from 'file-type-detector';
import { FileItem } from "./fileitem";
import { TopBar } from './TopBar';
import { WASMagic, WASMagicFlags } from 'wasmagic';
import { IframeManager } from './IframeManager';
import { FileList } from './FileList';
import { PasteModal } from './PasteModal';

export type HandlerConfig = {
    file: File,
    magicMime: string,
    handler: string,
}

export function App() {
    const [selected, setSelected] = useState(0)
    const [files, setFiles] = useState<File[]>([])
    const [activeHandlers, setActiveHandlers] = useState<(HandlerConfig | undefined)[]>([]);
    const [pinnedHandlers, setPinnedHandlers] = useState<string[][]>([]);
    const [pastedText, setPastedText] = useState<string | null>(null);

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
        setFiles(cur => [...cur, ...newFiles]);
        setActiveHandlers(cur => [...cur, ...Array(newFiles.length)])
        setPinnedHandlers(cur => [...cur, ...newFiles.map(() => [])]);
    }

    const removeFile = (index: number) => {
        setFiles(cur => {
            const newFiles = [...cur];
            newFiles.splice(index, 1);
            setSelected(prev => Math.min(prev, newFiles.length - 1));
            return newFiles;
        });
        setActiveHandlers(cur => {
            const newHandlers = [...cur];
            newHandlers.splice(index, 1);
            return newHandlers;
        });
        setPinnedHandlers(cur => {
            const newPinned = [...cur];
            newPinned.splice(index, 1);
            return newPinned;
        });
    };

    useEffect(() => {
        if (files.length > 0) {
            setSelected(files.length - 1);
        }
    }, [files]);

    useEffect(() => {
        const handleOpenFile = (e: CustomEvent<File[] | { file: File, additionalFiles?: File[], handler?: string }>) => {
            if (Array.isArray(e.detail)) {
                handleAddFiles(e.detail);
            } else {
                const { file, additionalFiles, handler } = e.detail;
                setFiles(cur => [...cur, file]);
                setActiveHandlers(cur => [
                    ...cur,
                    handler ? { file, handler, magicMime: file.type || 'application/octet-stream', additionalFiles } as any : undefined
                ]);
                setPinnedHandlers(cur => [...cur, []]);
            }
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
                        selected={selected}
                        onSelect={setSelected}
                        onRemove={removeFile}
                        onAddFiles={handleAddFiles}
                    />
                    <div id="result" style={files.length > 0 ? { flexGrow: 1, padding: '8px', position: 'relative', overflow: 'auto' } : {}}>
                        {files[selected] &&
                            <LoadFileItem
                                key={selected}
                                file={files[selected]}
                                openHandler={(handlerConfig: HandlerConfig) => {
                                    setActiveHandlers(cur => {
                                        const updatedHandlers = [...cur];
                                        updatedHandlers[selected] = handlerConfig;
                                        return updatedHandlers;
                                    });
                                }}
                                initialActiveHandler={activeHandlers[selected]}
                                pinnedHandlers={pinnedHandlers[selected] || []}
                                onAddPinnedHandler={(handlerId: string) => {
                                    setPinnedHandlers(cur => {
                                        const updatedPinned = [...cur];
                                        if (!updatedPinned[selected].includes(handlerId)) {
                                            updatedPinned[selected] = [...updatedPinned[selected], handlerId];
                                        }
                                        return updatedPinned;
                                    });
                                }}
                            />
                        }
                    </div>
                </div>
            </div>
            <IframeManager activeHandler={activeHandlers[selected]} files={files} />
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