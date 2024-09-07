if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

async function handleFile(file: File) {
    const myWorker = new Worker(new URL("worker.js", import.meta.url));
    myWorker.postMessage({ 'action': 'fileToWat', file }, [await file.arrayBuffer()])
    myWorker.onmessage = (e) => {
        document.getElementById('wat').innerText = e.data;
    }
}
