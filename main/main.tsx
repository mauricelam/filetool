import { WASMagic, WASMagicFlags } from "wasmagic";
import { createRoot } from 'react-dom/client';
import React from 'react';
import { IframeMessage } from "filemagic-common/messages";
import { App } from "./App";

const MAGIC = WASMagic.create({
    flags: WASMagicFlags.NONE,
    stdio: (name, text) => console.log(text)
});
const MIMEMAGIC = WASMagic.create({
    flags: WASMagicFlags.MIME_TYPE,
    stdio: (name, text) => console.log(text)
});

const root = createRoot(document.getElementById("root")!);

Promise.all([MAGIC, MIMEMAGIC]).then(([magic, mimeMagic]) => {
    root.render(<App openHandler={openHandler} magic={magic} mimeMagic={mimeMagic} iframes={iframes} fileToIframe={fileToIframe} />);
});

setupMessageListener();

function setupMessageListener() {
    window.onmessage = async (e: MessageEvent<IframeMessage>) => {
        let file: File | null = null;
        for (const [f, i] of fileToIframe.entries()) {
            if (i.contentWindow === e.source) {
                file = f;
                break;
            }
        }

        if (file) {
            const iframe = fileToIframe.get(file)!;
            const mime = iframeToMime.get(iframe)!;
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
}

const framecontainer = document.getElementById('framecontainer')!
const MAX_IFRAMES = 5;
const iframes: HTMLIFrameElement[] = [];
const fileToIframe = new Map<File, HTMLIFrameElement>();
const iframeToMime = new Map<HTMLIFrameElement, string>();
const iframeToHandler = new Map<HTMLIFrameElement, string>();

async function openHandler(handler: string, file: File, mime: string) {
    if (fileToIframe.has(file)) {
        const iframe = fileToIframe.get(file)!;
        if (iframeToHandler.get(iframe) !== handler) {
            iframe.removeAttribute('sandbox');
            iframe.src = handler;
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
        framecontainer.appendChild(iframe);
    } else {
        iframe = iframes.shift()!;
        iframes.push(iframe);
        // Find the file associated with this iframe and remove it from the map
        for (const [file, frame] of fileToIframe.entries()) {
            if (frame === iframe) {
                fileToIframe.delete(file);
                break;
            }
        }
    }

    fileToIframe.set(file, iframe);
    iframeToMime.set(iframe, mime);
    iframeToHandler.set(iframe, handler);

    iframes.forEach(f => f.style.display = 'none');
    iframe.style.display = 'block';

    iframe.removeAttribute('sandbox');
    iframe.src = handler;
}
