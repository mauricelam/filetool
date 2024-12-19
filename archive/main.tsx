import { Archive } from 'libarchive.js';
import React, { useState } from 'react';
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
    const files = await ar.getFilesObject()
    fileList.render(<FileTree files={files} />)
}

function FileTree({ files }: { files: {[key: string]: any} }) {
    return (
        <>
            {Object.entries(files).map(([dirname, obj]) => {
                if ('extract' in obj) {
                    const openFile = async () => {
                        const extractedFile = await obj.extract()
                        window.parent.postMessage({
                            action: 'openFile',
                            file: extractedFile
                        }, "/", [await extractedFile.arrayBuffer()])
                    }
                    const downloadFile = async () => {
                        const extractedFile = await obj.extract()
                        const url = URL.createObjectURL(extractedFile)
                        const anchor = document.createElement('a')
                        anchor.href = url
                        anchor.download = extractedFile.name
                        anchor.click()
                    }
                    const openButton = window.parent ? <a role="button" onClick={openFile} title="open"><svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343"><path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z"/></svg></a> : undefined
                    return (
                        <div key={obj.name} className="file">
                            {obj.name}
                            {openButton}
                            <a role="button" onClick={downloadFile} title="download"><svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#434343"><path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z"/></svg></a>
                        </div>
                    )
                } else {
                    return <Directory key={dirname} name={dirname} contents={obj} />
                }
            })}
        </>
    )
}

function Directory({ name, contents }: { name: string, contents: any }) {
    const [expanded, setExpanded] = useState(false)
    return (
        <div className={["directory", expanded ? "expanded" : ""].join(" ")}>
            <div className="filename" onClick={() => setExpanded(current => !current)}>{name}</div>
            <div style={{ display: expanded ? 'block' : 'none', paddingLeft: 16 }}>
                <FileTree files={contents} />
            </div>
        </div>
    )
}
