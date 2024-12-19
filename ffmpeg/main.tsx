import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const OUTPUT = createRoot(document.getElementById('output'))
// const FFMPEG = loadFFmpeg();

async function loadFFmpeg() {
    const ffmpeg = new FFmpeg()
    ffmpeg.on('log', ({ message }) => { console.log(message) })
    console.log("SharedArrayBuffer:", window.SharedArrayBuffer)
    await ffmpeg.load({
        coreURL: new URL(
            window.SharedArrayBuffer ? 'ffmpeg-core-mt.js' : 'ffmpeg-core.js',
            import.meta.url
        ).toString(),
        wasmURL: new URL(
            window.SharedArrayBuffer ? 'ffmpeg-core-mt.wasm' : 'ffmpeg-core.wasm',
            import.meta.url
        ).toString(),
        workerURL: window.SharedArrayBuffer ?
            new URL('ffmpeg-core-worker-mt.js', import.meta.url).toString() : ''
    })
    return ffmpeg
}

async function handleFile(file: File) {
    OUTPUT.render(<TranscodeVideo file={file} />)
}

enum Format {
    Mp4 = 'mp4',
    Mkv = 'mkv',
    // WebM = 'webm',
    Original = 'original'
}

const FORMAT_MIME = {
    'mp4': 'video/mp4',
    'mkv': 'video/matroska',
    // 'webm': 'video/webm',
}

type TranscodeResults = { [format: string]: undefined | number | File }

function TranscodeVideo({ file }: { file: File }) {
    const [current, setCurrent] = useState<Format>(Format.Original)
    const [results, setResults] = useState<TranscodeResults>({ [Format.Original]: file })

    const transcode = async (format: Format) => {
        setCurrent(_ => format)
        const ffmpeg = await loadFFmpeg()
        const onprogress = ({ progress, time }) => {
            setResults(f => ({ ...f, [format]: progress }))
        }
        ffmpeg.on('progress', onprogress)
        await ffmpeg.writeFile(file.name, new Uint8Array(await file.arrayBuffer()))
        const outputFileName = `output.${format}`
        await ffmpeg.exec(['-i', file.name, outputFileName, '-threads', '2', '-preset', 'ultrafast'])
        const data = await ffmpeg.readFile(outputFileName) as Uint8Array
        setResults(f => ({ ...f, [format]: new File([data.buffer], outputFileName, { type: FORMAT_MIME[format] }) }))
        ffmpeg.off('progress', onprogress)
    }

    const download = (file: File) => {
        const url = URL.createObjectURL(file)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = file.name
        anchor.click()
    }

    function videoUrl(): string {
        const transcoded = results[current]
        return transcoded instanceof Blob ?
            URL.createObjectURL(transcoded) : ''
    }

    return (
        <>
            <video src={videoUrl()} controls></video>
            {
                Object.values(Format).map(format => {
                    const result = results[format]
                    return (
                        <div key={format}>
                            {current == format ? '> ' + format : format}
                            {
                                result instanceof File ? (<>
                                    <button onClick={() => download(result)}>Download</button>
                                    <button onClick={() => setCurrent(_ => format)}>Preview</button>
                                </>)
                                    : typeof result === 'number' ? (<span> (Transcoding {Math.round(result as number * 10000) / 100}%...)</span>)
                                        : (<button onClick={() => transcode(format)}>Transcode</button>)
                            }
                        </div>
                    )
                })
            }
        </>
    )
}
