import { createRoot } from 'react-dom/client'
import { offset, renderAscii, renderHex } from './hex'
import React, { ReactNode, useEffect, useState } from 'react'

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
    const buf = new Uint8Array(await file.arrayBuffer())
    OUTPUT.render(<HexViewer buffer={buf} />)
}

function HexViewer({ buffer }: { buffer: Uint8Array }) {
    const lineCount = Math.ceil(buffer.length / 16)
    return (
        <div id="hexviewer">
            <Column id="offset" lineCount={lineCount}
                header="Offset"
                render={(i) => <div key={i}>{offset(i, buffer)}</div>} />
            <Column id="hex" lineCount={lineCount}
                header="00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F"
                render={(i) => <div key={i}>{renderHex(i, buffer)}</div>} />
            <Column id="ascii" lineCount={lineCount}
                header=" "
                render={(i) => <div key={i}>{renderAscii(i, buffer)}</div>} />
        </div>
    )
}

function Column({ id, render, lineCount, header }: { id: string, render: (i: number) => ReactNode, lineCount: number, header: string }) {
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const onScroll = () => { setOffset(window.scrollY) }
        window.removeEventListener('scroll', onScroll)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, []);

    const LINE_HEIGHT = 16;
    const adjustedOffset = offset - LINE_HEIGHT * 2; // for the header row
    let visibleRange = [Math.floor(adjustedOffset / LINE_HEIGHT), Math.ceil((adjustedOffset + window.innerHeight + 16) / LINE_HEIGHT)]
    const OFF_SCREEN_RENDER = 50;
    visibleRange = [Math.max(0, visibleRange[0] - OFF_SCREEN_RENDER), Math.min(lineCount, visibleRange[1] + OFF_SCREEN_RENDER)]

    return (
        <pre id={id}>
            <div style={{ paddingBottom: LINE_HEIGHT, height: LINE_HEIGHT }}>{header}</div>
            <div style={{ height: visibleRange[0] * LINE_HEIGHT }}></div>
            {Array.from((function* () {
                for (let i = visibleRange[0]; i < visibleRange[1]; i++) {
                    yield render(i)
                }
            })())}
            <div style={{ height: (lineCount - visibleRange[1] + 1) * LINE_HEIGHT }}></div>
        </pre>
    )
}
