import React from "react"
import { useState } from "react"
import { createRoot } from "react-dom/client"
import AceEditor from "react-ace"

import "ace-builds/src-noconflict/theme-twilight"
import "ace-builds/src-noconflict/mode-lisp"

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const ROOT = createRoot(document.getElementById('root'))

async function handleFile(file: File) {
    ROOT.render(<App file={file} />)
}

let currentWorker: Worker | undefined;

function App({ file }: { file: File }) {
    const [output, setOutput] = useState<string>()
    return (
        <>
            <button onClick={() => binutil('objdump', file, setOutput)}>objdump</button>
            <button onClick={() => binutil('nm', file, setOutput)}>nm</button>
            <button onClick={() => binutil('strings', file, setOutput)}>strings</button>
            <button onClick={() => binutil('readelf', file, setOutput)}>readelf</button>
            <button onClick={() => binutil('size', file, setOutput)}>size</button>

            <AceEditor value={output} width="100%" height="100%" theme="twilight" mode="lisp" style={{ flexGrow: 1 }} />
        </>
    )
}

async function binutil(action: string, file: File, setOutput: React.Dispatch<React.SetStateAction<string>>) {
    currentWorker?.terminate()
    setOutput(_ => "")
    currentWorker = new Worker(new URL("worker.js", import.meta.url), { type: 'module' });
    const buffer = await file.arrayBuffer()
    currentWorker.onmessage = (e) => setOutput(text => text + e.data + "\n")
    currentWorker.postMessage({ action, file }, [buffer])
}
