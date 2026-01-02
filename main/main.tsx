import { WASMagic, WASMagicFlags } from "wasmagic";
import { createRoot } from 'react-dom/client';
import React, { ReactNode, useEffect, useState } from 'react';
import { HANDLERS, HandlerDefinition, matchMimetype } from './handlers';
import { getDefaultHandler } from './defaultHandlers';
import { FileItem } from "./fileitem";

const dropTarget = document.getElementById('droptarget')!!
const fileInput = document.getElementById('fileinput') as HTMLInputElement
const pasteHint = document.getElementById('paste-hint')!!

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
pasteHint.innerText = isMac ? 'or Cmd-V to paste' : 'or Ctrl-V to paste';

fileInput.onchange = (e) => fileInput.files && dispatchOpenFiles(Array.from(fileInput.files));
dropTarget.onclick = (e) => fileInput.click();
dropTarget.addEventListener('drop', (e) => {
    dropTarget.classList.remove('dropover');
    e.preventDefault();
    const nonFileItems: DataTransferItem[] = [];
    const items = Array.from(e.dataTransfer!.items).filter(item => {
        if (item.webkitGetAsEntry()?.isDirectory) {
            alert("Error: Dropping folders is not supported.");
            return false;
        } else if (item.kind === 'file') {
            return true;
        } else {
            nonFileItems.push(item);
            return false;
        }
    });

    if (nonFileItems.length > 0) {
        const unsupportedItemsInfo = nonFileItems.map(item => `Type: ${item.type}, Kind: ${item.kind}`).join('\n');
        alert(`Warning: Drop of non-file items is not supported. Dropped items:\n${unsupportedItemsInfo}`);
        console.warn('Unsupported drop items:', nonFileItems);
    }
    if (items.length > 0) {
        dispatchOpenFiles(items.map(item => item.getAsFile()).filter((file): file is File => file !== null));
    }
}, false);

dropTarget.addEventListener('dragend', (e) => {
    dropTarget.classList.remove('dropover')
    e.preventDefault();
}, false);
dropTarget.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer!.dropEffect = 'copy'
}, false);
dropTarget.addEventListener('dragenter', (e) => {
    dropTarget.classList.add('dropover')
    e.preventDefault()
}, false);
dropTarget.addEventListener('dragleave', (e) => {
    dropTarget.classList.remove('dropover')
    e.preventDefault()
}, false);

document.ondragover = (e) => {
    e.dataTransfer!.dropEffect = 'none'
    e.dataTransfer!.effectAllowed = 'none'
    e.preventDefault()
}
document.ondragend = (e) => e.preventDefault()
document.ondrop = (e) => e.preventDefault()

document.addEventListener('paste', async (e) => {
    e.preventDefault();
    const files = Array.from(e.clipboardData?.items || [])
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null);

    if (files.length > 0) {
        dispatchOpenFiles(files);
        return;
    }

    const text = e.clipboardData?.getData('text/plain');
    if (text) {
        const file = new File([text], 'pasted.txt', { type: 'text/plain' });
        dispatchOpenFiles([file]);
        return;
    }

    alert('Cannot parse information from clipboard');
});

const MAGIC = WASMagic.create({
    flags: WASMagicFlags.NONE,
    stdio: (name, text) => console.log(text)
})
const MIMEMAGIC = WASMagic.create({
    flags: WASMagicFlags.MIME_TYPE,
    stdio: (name, text) => console.log(text)
})
const resultDiv = createRoot(document.getElementById("result")!)
resultDiv.render(<FileList />)
setupMessageListener();

function setupMessageListener() {
    window.onmessage = async (e) => {
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
                    { 'action': 'respondFile', file: fileCopy, 'originalType': file.type },
                    "/", [await file.arrayBuffer()]);
            } else if (e.data.action === 'openFile') {
                console.log('onmessage', e.data);
                window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: [e.data.file] }));
            }
        }
    };
}

function dispatchOpenFiles(files: File[]) {
    window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: files }))
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
            if (handler === '__text__') {
                iframe.setAttribute('sandbox', '');
                iframe.src = URL.createObjectURL(new File([await file.arrayBuffer()], file.name, { type: 'text/plain' }));
            } else {
                iframe.removeAttribute('sandbox');
                iframe.src = handler;
            }
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

    if (handler === '__text__') {
        iframe.setAttribute('sandbox', '');
        iframe.src = URL.createObjectURL(new File([await file.arrayBuffer()], file.name, { type: 'text/plain' }));
    } else {
        iframe.removeAttribute('sandbox');
        iframe.src = handler;
    }
}

function FileList() {
    const [selected, setSelected] = useState(0)
    const [files, setFiles] = useState<File[]>([])

    useEffect(() => {
        const handleOpenFile = (e: CustomEvent<File[]>) => {
            setFiles(cur => [...cur, ...e.detail])
            setSelected(_ => files.length)
        }
        window.addEventListener("openFiles", handleOpenFile as EventListener, false)
        return () => window.removeEventListener("openFiles", handleOpenFile as EventListener)
    }, [setFiles, files])

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

    if (files.length) {
        const selectedFile = files[selected];
        iframes.forEach(f => f.style.display = 'none');
        if (selectedFile && fileToIframe.has(selectedFile)) {
            fileToIframe.get(selectedFile)!.style.display = 'block';
        }

        return (
            <>
                <div style={{ display: files.length <= 1 ? 'none' : 'block', position: 'absolute', top: 0, right: 0, userSelect: 'none' }}>
                    <a style={{ cursor: "pointer" }} onClick={() => setSelected(i => Math.max(0, i - 1))}>◀</a>
                    <span>{selected + 1} / {files.length}</span>
                    <a style={{ cursor: "pointer" }} onClick={() => setSelected(i => Math.min(files.length - 1, i + 1))}>▶</a>
                </div>
                {files.length ? <LoadFileItem key={selected} file={files[selected]} /> : undefined}
            </>
        )
    } else {
        return <></>
    }
}

function LoadFileItem({ file }: { file: File }): ReactNode {
    const [handlers, setHandlers] = useState<any[]>([])
    const [mime, setMime] = useState("")
    const [description, setDescription] = useState("Loading...")
    useEffect(() => {
        const fun = async () => {
            const [magic, mimeMagic] = await Promise.all([MAGIC, MIMEMAGIC])
            const fileBuf = new Uint8Array(await file.arrayBuffer())
            const mime = mimeMagic.detect(fileBuf)
            const fileDescription = magic.detect(fileBuf) // Store description
            const handlers: HandlerDefinition[] = [];
            for (const handler of HANDLERS) {
                // Pass fileDescription to matchMimetype
                const match = handler.mimetypes.some(m => matchMimetype(m, mime, file.name, fileDescription))
                if (match) {
                    handlers.push(handler)
                }
            }
            setMime(_ => mime)
            setHandlers(_ => handlers)
            setDescription(_ => fileDescription)

            // Push new state to history
            if (window.history.state?.fileName !== file.name) {
                window.history.pushState({
                    fileName: file.name,
                }, file.name);
            }

            // Check for and use default handler
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
        }
        fun()
    }, [setHandlers, setDescription, setMime, file])
    const defaultHandler = getDefaultHandler(mime, file.name);
    return (
        <FileItem
            key={file.name}
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
