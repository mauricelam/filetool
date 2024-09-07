import { Archive } from 'libarchive.js';
import { CompressedFile } from 'libarchive.js/dist/build/compiled/compressed-file';
import React from 'react';
import { createRoot } from 'react-dom/client';
Archive.init({ workerUrl: 'libarchive-worker-bundle.js' })

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const fileList = createRoot(document.getElementById('filelist'))

async function handleFile(file: File) {
    const ar = await Archive.open(file)
    const files = await ar.getFilesArray()
    fileList.render(
        files.map(f => {
            const file: CompressedFile = f.file
            const fullPath = `${f.path}${file.name}`
            const openFile = async () => {
                const extractedFile = await file.extract()
                window.parent.postMessage({
                    action: 'openFile',
                    file: extractedFile
                }, "/", [await extractedFile.arrayBuffer()])
            }
            const downloadFile = async () => {
                const extractedFile = await file.extract()
                const url = URL.createObjectURL(extractedFile)
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = extractedFile.name
                anchor.click()
            }
            const openButton = window.parent ? <button onClick={openFile}>open</button> : undefined
            return (
                <div key={fullPath}>
                    {fullPath}
                    {openButton}
                    <button onClick={downloadFile}>download</button>
                </div>
            )
        })
    )
}
