import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import AceEditor from "react-ace"

import "ace-builds/src-noconflict/theme-twilight"
import "ace-builds/src-noconflict/mode-lisp"

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const OUTPUT = createRoot(document.getElementById('editor'))

async function handleFile(file: File) {
    const myWorker = new Worker(new URL("worker.js", import.meta.url));
    myWorker.postMessage({ 'action': 'fileToWat', file }, [await file.arrayBuffer()])
    myWorker.onmessage = (e) => {
        OUTPUT.render(
            <AceEditor value={e.data} width="100%" height="100%" theme="twilight" mode="lisp" />
        )
    }
}
