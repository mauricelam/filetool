import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './topbar';
import { DropArea } from './droparea';
import { FileList } from './filelist';
import { IframeMessage } from "filemagic-common/messages";

const MAX_IFRAMES = 5;

export function App() {
    const [files, setFiles] = useState<File[]>([]);
    const [selected, setSelected] = useState(0);
    const framecontainerRef = useRef<HTMLDivElement>(null);

    const iframesRef = useRef<HTMLIFrameElement[]>([]);
    const fileToIframeRef = useRef(new Map<File, HTMLIFrameElement>());
    const iframeToMimeRef = useRef(new Map<HTMLIFrameElement, string>());
    const iframeToHandlerRef = useRef(new Map<HTMLIFrameElement, string>());

    useEffect(() => {
        const handleOpenFile = (e: CustomEvent<File[]>) => {
            setFiles(cur => {
                const newFiles = [...cur, ...e.detail];
                setSelected(newFiles.length - 1);
                return newFiles;
            });
        };
        window.addEventListener("openFiles", handleOpenFile as EventListener, false);
        return () => window.removeEventListener("openFiles", handleOpenFile as EventListener);
    }, []);

    const dispatchOpenFiles = (files: File[]) => {
        window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: files }));
    };

    const openHandler = (handler: string, file: File, mime: string) => {
        const fileToIframe = fileToIframeRef.current;
        const iframeToHandler = iframeToHandlerRef.current;
        const iframes = iframesRef.current;

        if (fileToIframe.has(file)) {
            const iframe = fileToIframe.get(file)!;
            if (iframeToHandler.get(iframe) !== handler) {
                iframe.removeAttribute('sandbox');
                iframe.src = new URL(handler, window.location.href).href;
                iframeToHandler.set(iframe, handler);
            }
            iframes.forEach(f => f.style.display = 'none');
            iframe.style.display = 'block';
            return;
        }

        let iframe: HTMLIFrameElement;
        if (iframes.length < MAX_IFRAMES) {
            iframe = document.createElement('iframe');
            iframes.push(iframe);
            framecontainerRef.current?.appendChild(iframe);
        } else {
            iframe = iframes.shift()!;
            iframes.push(iframe);
            for (const [file, frame] of fileToIframe.entries()) {
                if (frame === iframe) {
                    fileToIframe.delete(file);
                    break;
                }
            }
        }

        fileToIframe.set(file, iframe);
        iframeToMimeRef.current.set(iframe, mime);
        iframeToHandler.set(iframe, handler);

        iframes.forEach(f => f.style.display = 'none');
        iframe.style.display = 'block';

        iframe.removeAttribute('sandbox');
        iframe.src = new URL(handler, window.location.href).href;
    };

    useEffect(() => {
        const messageListener = async (e: MessageEvent<IframeMessage>) => {
            let file: File | null = null;
            for (const [f, i] of fileToIframeRef.current.entries()) {
                if (i.contentWindow === e.source) {
                    file = f;
                    break;
                }
            }

            if (file) {
                const iframe = fileToIframeRef.current.get(file)!;
                const mime = iframeToMimeRef.current.get(iframe)!;
                if (e.data.action === 'requestFile') {
                    const fileContent = await file.arrayBuffer();
                    iframe.contentWindow!.postMessage(
                        { action: 'respondFile', file: new File([fileContent], file.name, { type: mime }), originalType: file.type },
                        "/",
                        [fileContent]
                    );
                } else if (e.data.action === 'openFile') {
                    window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: [e.data.file] }));
                }
            }
        };

        window.addEventListener('message', messageListener);
        return () => window.removeEventListener('message', messageListener);
    }, []);

    return (
        <>
            <TopBar files={files} />
            <div id="basicinfo">
                {files.length === 0 ? (
                    <DropArea onFilesSelected={dispatchOpenFiles} />
                ) : (
                    <FileList
                        files={files}
                        selected={selected}
                        setSelected={setSelected}
                        openHandler={openHandler}
                        iframes={iframesRef.current}
                        fileToIframe={fileToIframeRef.current}
                    />
                )}
            </div>
            <div id="framecontainer" ref={framecontainerRef}></div>
        </>
    );
}
