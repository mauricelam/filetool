import { WASMagic, WASMagicFlags } from "wasmagic";
import { createRoot } from 'react-dom/client';
import * as React from 'react';
import HANDLERS from './handlers';

const dropTarget = document.getElementById('droptarget')
const fileInput = document.getElementById('fileinput') as HTMLInputElement

fileInput.onchange = (e) => handleFiles(fileInput.files);
dropTarget.onclick = (e) => fileInput.click();
dropTarget.addEventListener('drop', (e) => {
    dropTarget.classList.remove('dropover')
    e.preventDefault();
    handleFiles(e.dataTransfer.files)
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
let resultElements = []

async function handleFiles(files: FileList) {
    resultElements = await Promise.all(Array.from(files).map((f) => renderFile(f)))
    resultDiv.render(resultElements)
}

const iframe = document.getElementById('handler') as HTMLIFrameElement

async function openHandler(handler: string, file: File, mime: string) {
    if (handler === '__browser__') {
        iframe.src = URL.createObjectURL(file)
    } else if (handler === '__text__') {
        iframe.src = URL.createObjectURL(new Blob([await file.arrayBuffer()]))
    } else {
        iframe.src = handler
    }
    window.onmessage = async (e) => {
        if (e.source === iframe.contentWindow) {
            if (e.data.action === 'requestFile') {
                iframe.contentWindow.postMessage({ 'action': 'respondFile', file }, "/", [await file.arrayBuffer()])
            } else if (e.data.action === 'openFile') {
                console.log('onmessage', e.data)
                resultElements = [...resultElements, await renderFile(e.data.file)]
                resultDiv.render(resultElements)
            }
        }
    }
}

async function renderFile(file: File) {
    iframe.removeAttribute('src')
    const [magic, mimeMagic] = await Promise.all([MAGIC, MIMEMAGIC])
    const fileBuf = new Uint8Array(await file.arrayBuffer())
    const mime = mimeMagic.detect(fileBuf)
    if (mime !== file.type) {
        file = new File([fileBuf], file.name, { type: mime })
    }
    const handlers = [];
    for (const handler of HANDLERS) {
        const match = handler.mimetypes.some(m => {
            if (m instanceof RegExp) {
                return m.test(mime)
            } else if (typeof m === 'string') {
                return m === mime
            } else {
                return m.mime === mime && m.filename.test(file.name)
            }
        })
        if (match) {
            handlers.push(handler)
        }
    }
    const handlerButtons = handlers.map(handler => (
        <button
            key={handler.name}
            onClick={() => openHandler(handler.handler, file, mime)}
        >
            {handler.name}
        </button>
    ))
    return (
        <div key={file.name}>
            <div className="filename">{file.name}</div>
            <div className="mime">{mime}</div>
            <div className="filedescription">{magic.detect(fileBuf)}</div>
            <div className="buttonBar">{handlerButtons}</div>
        </div>
    )
}
