import { WASMagic, WASMagicFlags } from "wasmagic";
import { createRoot } from 'react-dom/client';
import React, { ReactNode, useEffect, useState } from 'react';
import HANDLERS, { matchMimetype } from './handlers';
import { getDefaultHandler } from './defaultHandlers';
import { FileItem } from "./fileitem";

const dropTarget = document.getElementById('droptarget')
const fileInput = document.getElementById('fileinput') as HTMLInputElement

fileInput.onchange = (e) => dispatchOpenFiles(Array.from(fileInput.files));
dropTarget.onclick = (e) => fileInput.click();
dropTarget.addEventListener('drop', (e) => {
    dropTarget.classList.remove('dropover')
    e.preventDefault();
    let hasNonFile = false
    const items = Array.from(e.dataTransfer.items).filter(item => {
        if (item.webkitGetAsEntry()?.isFile) {
            return true
        } else {
            hasNonFile = true
            return false
        }
    })
    if (hasNonFile) {
        alert("Warning: Drop of non-file items (directories or text) is not supported")
    }
    if (items.length > 0) {
        dispatchOpenFiles(items.map(item => item.getAsFile()));
    }
}, false);

dropTarget.addEventListener('dragend', (e) => {
    dropTarget.classList.remove('dropover')
    e.preventDefault();
}, false);
dropTarget.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
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
    e.dataTransfer.dropEffect = 'none'
    e.dataTransfer.effectAllowed = 'none'
    e.preventDefault()
}
document.ondragend = (e) => e.preventDefault()
document.ondrop = (e) => e.preventDefault()

const MAGIC = WASMagic.create({
    flags: WASMagicFlags.NONE,
    stdio: (name, text) => console.log(text)
})
const MIMEMAGIC = WASMagic.create({
    flags: WASMagicFlags.MIME_TYPE,
    stdio: (name, text) => console.log(text)
})
const resultDiv = createRoot(document.getElementById("result"))
resultDiv.render(<FileList />)

function dispatchOpenFiles(files: File[]) {
    window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: files }))
}

const framecontainer = document.getElementById('framecontainer')

async function openHandler(handler: string, file: File, mime: string) {
    // Clear existing iframes
    framecontainer.innerHTML = '';

    // Create new iframe
    const iframe = document.createElement('iframe');
    framecontainer.appendChild(iframe);

    if (handler === '__text__') {
        iframe.setAttribute('sandbox', '');
        iframe.src = URL.createObjectURL(new File([await file.arrayBuffer()], file.name, { type: 'text/plain' }));
    } else {
        iframe.removeAttribute('sandbox');
        iframe.src = handler;
    }

    window.onmessage = async (e) => {
        if (e.source === iframe.contentWindow) {
            if (e.data.action === 'requestFile') {
                if (file.type !== mime) {
                    console.log("Mismatched mime types", file.type, mime);
                }
                const fileCopy = new File([file], file.name, { type: mime });
                iframe.contentWindow.postMessage(
                    { 'action': 'respondFile', file: fileCopy, 'originalType': file.type },
                    "/", [await file.arrayBuffer()]);
            } else if (e.data.action === 'openFile') {
                console.log('onmessage', e.data);
                window.dispatchEvent(new CustomEvent<File[]>("openFiles", { detail: [e.data.file] }));
            }
        }
    };
}

function FileList() {
    const [selected, setSelected] = useState(0)
    const [files, setFiles] = useState([])

    useEffect(() => {
        const handleOpenFile = (e: CustomEvent<File[]>) => {
            setFiles(cur => [...cur, ...e.detail])
            setSelected(_ => files.length)
        }
        window.addEventListener("openFiles", handleOpenFile, false)
        return () => window.removeEventListener("openFiles", handleOpenFile)
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
    framecontainer.innerHTML = ''
    const [handlers, setHandlers] = useState([])
    const [mime, setMime] = useState("")
    const [description, setDescription] = useState("Loading...")
    useEffect(() => {
        const fun = async () => {
            const [magic, mimeMagic] = await Promise.all([MAGIC, MIMEMAGIC])
            const fileBuf = new Uint8Array(await file.arrayBuffer())
            const mime = mimeMagic.detect(fileBuf)
            if (mime !== file.type) {
                file = new File([fileBuf], file.name, { type: mime })
            }
            const fileDescription = magic.detect(fileBuf) // Store description
            const handlers = [];
            for (const handler of HANDLERS) {
                // Pass fileDescription to matchMimetype
                const match = handler.mimetypes.some(m => matchMimetype(m, mime, file.name, fileDescription))
                if (match) {
                    handlers.push(handler)
                }
            }
            return [mime, handlers, fileDescription] // return fileDescription
        }
        fun().then(
            ([mime, handlers, description]: [string, any, string]) => {
                setMime(_ => mime)
                setHandlers(_ => handlers)
                setDescription(_ => description)

                // Push new state to history
                if (window.history.state.fileName !== file.name) {
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
            },
            (reason) => {
                setMime(_ => "")
                setHandlers(_ => [])
                setDescription(_ => `Error: ${reason}`)
            })
    }, [setHandlers, setDescription, setMime, file])
    const defaultHandler = getDefaultHandler(mime, file.name);
    return (
        <FileItem
            key={file.name}
            name={file.name}
            mimetype={mime}
            description={description}
            matchedHandlers={handlers}
            initialActiveHandler={defaultHandler}
            onOpenHandler={(handlerId, filename, mimetype) => {
                openHandler(handlerId, file, mimetype);
            }}
        />
    )
}
