import React, { ReactNode, useEffect, useState } from 'react';
import { WASMagic, WASMagicFlags } from "wasmagic";
import { HANDLERS, matchMimetype, getDefaultHandler, getHandlersForFileNameAndType } from 'file-type-detector';
import { FileItem } from "./fileitem";

const MAGIC = WASMagic.create({
    flags: WASMagicFlags.NONE,
    stdio: (name, text) => console.log(text)
});
const MIMEMAGIC = WASMagic.create({
    flags: WASMagicFlags.MIME_TYPE,
    stdio: (name, text) => console.log(text)
});

interface FileListProps {
    files: File[];
    selected: number;
    setSelected: (index: number) => void;
    openHandler: (handler: string, file: File, mime: string) => void;
    iframes: HTMLIFrameElement[];
    fileToIframe: Map<File, HTMLIFrameElement>;
}

export function FileList({ files, selected, setSelected, openHandler, iframes, fileToIframe }: FileListProps) {
    useEffect(() => {
        const selectedFile = files[selected];
        iframes.forEach(f => f.style.display = 'none');
        if (selectedFile && fileToIframe.has(selectedFile)) {
            fileToIframe.get(selectedFile)!.style.display = 'block';
        }
    }, [selected, files, iframes, fileToIframe]);

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
    }, [files, setSelected]);

    return (
        <div id="result">
            <div style={{ display: files.length <= 1 ? 'none' : 'block', position: 'absolute', top: 0, right: 0, userSelect: 'none' }}>
                <a style={{ cursor: "pointer" }} onClick={() => setSelected(Math.max(0, selected - 1))}>◀</a>
                <span>{selected + 1} / {files.length}</span>
                <a style={{ cursor: "pointer" }} onClick={() => setSelected(Math.min(files.length - 1, selected + 1))}>▶</a>
            </div>
            {files.length && selected < files.length ? <LoadFileItem key={selected} file={files[selected]} openHandler={openHandler} /> : null}
        </div>
    );
}

function LoadFileItem({ file, openHandler }: { file: File, openHandler: (handler: string, file: File, mime: string) => void }): ReactNode {
    const [handlers, setHandlers] = useState<any[]>([]);
    const [mime, setMime] = useState("");
    const [description, setDescription] = useState("Loading...");

    useEffect(() => {
        const fun = async () => {
            const [magic, mimeMagic] = await Promise.all([MAGIC, MIMEMAGIC]);
            const fileBuf = new Uint8Array(await file.arrayBuffer());
            const mime = mimeMagic.detect(fileBuf);
            const fileDescription = magic.detect(fileBuf);
            const handlers = getHandlersForFileNameAndType(file.name, mime, fileDescription);
            setMime(mime);
            setHandlers(handlers);
            setDescription(fileDescription);

            if (window.history.state?.fileName !== file.name) {
                window.history.pushState({
                    fileName: file.name,
                }, file.name);
            }

            const defaultHandlerId = getDefaultHandler(mime, file.name);
            if (defaultHandlerId) {
                const defaultHandlerConfig = HANDLERS.find(h => h.handler === defaultHandlerId);
                if (defaultHandlerConfig) {
                    const isMatch = defaultHandlerConfig.mimetypes.some(m => matchMimetype(m, mime, file.name));
                    if (isMatch) {
                        setTimeout(
                            () => openHandler(defaultHandlerConfig.handler, file, mime),
                            0);
                    } else {
                        console.warn(`Default handler '${defaultHandlerId}' no longer matches file '${file.name}' (mime: '${mime}').`);
                    }
                } else {
                    console.warn(`Default handler '${defaultHandlerId}' not found in HANDLERS configuration.`);
                }
            }
        };
        fun();
    }, [file, openHandler]);

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
    );
}
