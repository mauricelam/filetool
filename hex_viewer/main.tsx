import hex from './hex'

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const offsetPre = document.getElementById('offset')
const hexPre = document.getElementById('hex')
const asciiPre = document.getElementById('ascii')

async function handleFile(file: File) {
    offsetPre.innerHTML = 'Offset\n\n'
    hexPre.innerHTML = ' 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F\n\n'
    asciiPre.innerHTML = '\n\n'

    const buf = new Uint8Array(await file.arrayBuffer())
    let i = 0;
    for await (const [offset, hexStr, ascii] of hex(buf)) {
        offsetPre.appendChild(wrapInDiv(offset))
        hexPre.appendChild(wrapInDiv(hexStr))
        asciiPre.appendChild(wrapInDiv(ascii))
        if (i % 1024 === 0) {
            await sleep(0)
        }
        i++
    }
}

function wrapInDiv(...str: string[]): HTMLDivElement {
    const div = document.createElement('div')
    div.innerHTML += str.join('\n')
    return div
}

function sleep(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, time))
}
