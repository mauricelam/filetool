import Markdown from 'react-markdown';
import { createRoot } from 'react-dom/client';
import React from 'react';

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const OUTPUT = createRoot(document.getElementById('output'))

async function handleFile(file: File) {
    const contents = await file.text()
    OUTPUT.render(<Markdown>{contents}</Markdown>)
}
