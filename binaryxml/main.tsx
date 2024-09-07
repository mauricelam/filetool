import { createRoot } from 'react-dom/client'
import { decode_apk } from './abxml-wrapper/pkg'
import React from 'react'

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const OUTPUT = createRoot(document.getElementById('output')!!)

async function handleFile(file: File) {
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const decoded = decode_apk(fileBytes)
    console.log('decoded', decoded)
    const entries = decoded.map(([name, contents]: [string, string]) => {
        return (
            <div key={name}>
                <label onClick={e => e.currentTarget.parentElement!.classList.toggle('expanded')}>{name}</label>
                <pre>{contents}</pre>
            </div>
        )
    })
    OUTPUT.render(entries)
}
