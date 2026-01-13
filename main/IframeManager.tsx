import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { IframeMessage } from "filemagic-common/messages";

interface IframeManagerProps {
    activeHandler?: { file: File, magicMime: string, handler: string };
}

export function IframeManager({ activeHandler }: IframeManagerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const iframes = useRef<HTMLIFrameElement[]>([]);
    const fileToIframe = useRef<Map<File, HTMLIFrameElement>>(new Map());
    const fileToMime = useRef<Map<File, string>>(new Map());
    const iframeToHandler = useRef<Map<HTMLIFrameElement, string>>(new Map());
    const MAX_IFRAMES = 5;

    useEffect(() => {
        const effect = async () => {
            if (!activeHandler) return
            if (fileToIframe.current.has(activeHandler.file)) {
                const iframe = fileToIframe.current.get(activeHandler.file)!;
                if (iframeToHandler.current.get(iframe) !== activeHandler.handler) {
                    iframe.removeAttribute('sandbox');
                    iframe.src = activeHandler.handler;
                    iframeToHandler.current.set(iframe, activeHandler.handler);
                }
                iframes.current.forEach(f => f.style.display = 'none');
                iframe.style.display = 'block';
                return;
            }

            let iframe: HTMLIFrameElement;
            if (iframes.current.length < MAX_IFRAMES) {
                iframe = document.createElement('iframe');
                iframe.style.display = 'none'; // default hidden
                iframes.current.push(iframe);
                if (containerRef.current) {
                    containerRef.current.appendChild(iframe);
                }
            } else {
                iframe = iframes.current.shift()!;
                iframes.current.push(iframe);
                // Find the file associated with this iframe and remove it from the map
                for (const [f, frame] of fileToIframe.current.entries()) {
                    if (frame === iframe) {
                        fileToIframe.current.delete(f);
                        break;
                    }
                }
            }

            fileToIframe.current.set(activeHandler.file, iframe);
            fileToMime.current.set(activeHandler.file, activeHandler.magicMime);
            iframeToHandler.current.set(iframe, activeHandler.handler);

            iframes.current.forEach(f => f.style.display = 'none');
            iframe.style.display = 'block';

            iframe.removeAttribute('sandbox');
            iframe.src = activeHandler.handler;
        }
        effect()
    }, [activeHandler])

    // Sync visibility when activeFile changes from props
    useEffect(() => {
        iframes.current.forEach(f => f.style.display = 'none');
        if (activeHandler && fileToIframe.current.has(activeHandler.file)) {
            const iframe = fileToIframe.current.get(activeHandler.file)!;
            iframe.style.display = 'block';
        }
    }, [activeHandler]);

    // Message Listener
    useEffect(() => {
        const onMessage = async (e: MessageEvent<IframeMessage>) => {
            let file: File | null = null;
            for (const [f, i] of fileToIframe.current.entries()) {
                if (i.contentWindow === e.source) {
                    file = f;
                    break;
                }
            }

            if (file) {
                const iframe = fileToIframe.current.get(file)!;
                const mime = fileToMime.current.get(file)!;
                if (e.data.action === 'requestFile') {
                    if (file.type !== mime) {
                        console.log("Mismatched mime types", file.type, mime);
                    }
                    const fileCopy = new File([file], file.name, { type: mime });
                    iframe.contentWindow!.postMessage(
                        { action: 'respondFile', file: fileCopy, originalType: file.type },
                        "/", [await file.arrayBuffer()]);
                } else if (e.data.action === 'openFile') {
                    console.log('onmessage', e.data);
                    window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: [e.data.file] }));
                }
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    return (
        <div id="framecontainer" ref={containerRef}></div>
    );
}
