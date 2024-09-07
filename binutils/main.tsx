window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

const OUTPUT = document.getElementById('output')

async function handleFile(file: File) {
    OUTPUT.innerText = ''
    document.getElementById('objdump').onclick = async () => {
        binutil('objdump', file)
    };
    document.getElementById('nm').onclick = async () => {
        binutil('nm', file)
    };
    document.getElementById('strings').onclick = async () => {
        binutil('strings', file)
    };
    document.getElementById('readelf').onclick = async () => {
        binutil('readelf', file)
    };
    document.getElementById('size').onclick = async () => {
        binutil('size', file)
    };
}

async function binutil(action: string, file: File) {
    OUTPUT.innerText = ''
    const binutilsWorker = new Worker(new URL("worker.js", import.meta.url), { type: 'module' });
    binutilsWorker.onmessage = (e) => {
        const div = document.createElement('div')
        div.innerText = e.data
        OUTPUT.appendChild(div)
    }
    binutilsWorker.postMessage({ action, file }, [await file.arrayBuffer()])
}
