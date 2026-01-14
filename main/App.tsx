import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { HANDLERS, matchMimetype, getDefaultHandler, getHandlersForFileNameAndType } from 'file-type-detector';
import { FileItem } from "./fileitem";
import { TopBar } from './TopBar';
import { WASMagic, WASMagicFlags } from 'wasmagic';
import { IframeManager } from './IframeManager';
import { FileList } from './FileList';

export function App() {
    const [selected, setSelected] = useState(0)
    const [files, setFiles] = useState<File[]>([])
    const [activeHandler, setActiveHandler] = useState<{ file: File, magicMime: string, handler: string } | undefined>(undefined);

    const handlePaste = async (e: ClipboardEvent) => {
        e.preventDefault();
        const files = Array.from(e.clipboardData?.items || [])
            .filter(item => item.kind === 'file')
            .map(item => item.getAsFile())
            .filter((file): file is File => file !== null);

        if (files.length > 0) {
            handleAddFiles(files);
            return;
        }

        const text = e.clipboardData?.getData('text/plain');
        if (text) {
            const file = new File([text], 'pasted.txt', { type: 'text/plain' });
            handleAddFiles([file]);
            return;
        }
    };

    // Global paste handler
    useEffect(() => {
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, []);

    const handleAddFiles = (newFiles: File[]) => {
        setFiles(cur => {
            const updatedFiles = [...cur, ...newFiles];
            setSelected(updatedFiles.length > 0 ? updatedFiles.length - 1 : 0);
            return updatedFiles;
        });
    }

    const removeFile = (index: number) => {
        if (activeHandler && files[index] === activeHandler.file) {
            setActiveHandler(undefined);
        }
        setFiles(cur => {
            const newFiles = [...cur];
            newFiles.splice(index, 1);
            return newFiles;
        });
        setSelected(prev => Math.min(prev, files.length - 2));
    };

    useEffect(() => {
        if (files.length > 0 && selected >= files.length) {
            setSelected(files.length - 1);
        }
    }, [files.length, selected]);

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

    return (
        <>
            <TopBar showToggle={files.length > 0} />
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
                                openHandler={(handler: string, file: File, mime: string) => {
                                    setActiveHandler({ file, magicMime: mime, handler });
                                }}
                            />
                        }
                    </div>
                </div>
            </div>
            <IframeManager activeHandler={activeHandler} files={files} />
        </>
    );
}

interface LoadFileItemProps {
    file: File;
    openHandler: (handler: string, file: File, mime: string) => void;
}

function LoadFileItem({ file, openHandler }: LoadFileItemProps): ReactNode {
    const [handlers, setHandlers] = useState<any[]>([]);
    const [mime, setMime] = useState("");
    const [description, setDescription] = useState("Loading...");

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
        effect()
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
            onOpenHandler={openHandler}
        />
    )
}