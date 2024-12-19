import { createRoot } from 'react-dom/client'
import React, { ReactNode, useEffect, useState } from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { monokaiSublime } from 'react-syntax-highlighter/dist/esm/styles/hljs'

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
    OUTPUT.render(<TextViewer content={await file.text()} />)
}

function TextViewer({ content }: { content: string }) {
    return (
        <SyntaxHighlighter id="textviewer" language="highlightAuto" style={monokaiSublime}>
            {content}
        </SyntaxHighlighter>
    )
}

// function Column({ id, render, lineCount, header }: { id: string, render: (i: number) => ReactNode, lineCount: number, header: string }) {
//     const [offset, setOffset] = useState(0);

//     useEffect(() => {
//         const onScroll = () => { setOffset(window.scrollY) }
//         window.removeEventListener('scroll', onScroll)
//         window.addEventListener('scroll', onScroll, { passive: true })
//         return () => window.removeEventListener('scroll', onScroll)
//     }, []);

//     const LINE_HEIGHT = 16;
//     const adjustedOffset = offset - LINE_HEIGHT * 2; // for the header row
//     let visibleRange = [Math.floor(adjustedOffset / LINE_HEIGHT), Math.ceil((adjustedOffset + window.innerHeight + 16) / LINE_HEIGHT)]
//     const OFF_SCREEN_RENDER = 50;
//     visibleRange = [Math.max(0, visibleRange[0] - OFF_SCREEN_RENDER), Math.min(lineCount, visibleRange[1] + OFF_SCREEN_RENDER)]

//     return (
//         <pre id={id}>
//             <div style={{ paddingBottom: LINE_HEIGHT, height: LINE_HEIGHT }}>{header}</div>
//             <div style={{ height: visibleRange[0] * LINE_HEIGHT }}></div>
//             {Array.from((function* () {
//                 for (let i = visibleRange[0]; i < visibleRange[1]; i++) {
//                     yield render(i)
//                 }
//             })())}
//             <div style={{ height: (lineCount - visibleRange[1] + 1) * LINE_HEIGHT }}></div>
//         </pre>
//     )
// }
