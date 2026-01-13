import React, { ReactNode, useEffect, useState } from 'react';
import { HANDLERS, matchMimetype, getDefaultHandler, getHandlersForFileNameAndType } from 'file-type-detector';
import { FileItem } from "./fileitem";
import { TopBar } from './TopBar';
import { DropTarget } from './DropTarget';
import { WASMagic } from 'wasmagic';

interface AppProps {
    openHandler: (handler: string, file: File, mime: string) => void;
    magic: WASMagic;
    mimeMagic: WASMagic;
    iframes: HTMLIFrameElement[];
    fileToIframe: Map<File, HTMLIFrameElement>;
}

export function App({ openHandler, magic, mimeMagic, iframes, fileToIframe }: AppProps) {
    const [selected, setSelected] = useState(0)
    const [files, setFiles] = useState<File[]>([])

    const handleAddFiles = (newFiles: File[]) => {
        setFiles(cur => {
            const updatedFiles = [...cur, ...newFiles];
            setSelected(updatedFiles.length > 0 ? updatedFiles.length - 1 : 0);
            return updatedFiles;
        });
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

    useEffect(() => {
        if (files.length > 0) {
            const selectedFile = files[selected];
            iframes.forEach(f => f.style.display = 'none');
            if (selectedFile && fileToIframe.has(selectedFile)) {
                fileToIframe.get(selectedFile)!.style.display = 'block';
            }
        }
    }, [files, selected, iframes, fileToIframe]);

    function LoadFileItem({ file }: { file: File }): ReactNode {
        const [handlers, setHandlers] = useState<any[]>([]);
        const [mime, setMime] = useState("");
        const [description, setDescription] = useState("Loading...");

        useEffect(() => {
            const fun = async () => {
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
                    <div id="result">
                        <div style={{ display: files.length <= 1 ? 'none' : 'block', position: 'absolute', top: 0, right: 0, userSelect: 'none' }}>
                            <a style={{ cursor: "pointer" }} onClick={() => setSelected(i => Math.max(0, i - 1))}>◀</a>
                            <span>{selected + 1} / {files.length}</span>
                            <a style={{ cursor: "pointer" }} onClick={() => setSelected(i => Math.min(files.length - 1, i + 1))}>▶</a>
                        </div>
                        <LoadFileItem key={selected} file={files[selected]} />
                    </div>
                )}
            </div>
        </>
    );
}
