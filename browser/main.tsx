async function handleFile(file: File) {
    console.log('file', file)
    const iframe = document.getElementById('iframe') as HTMLIFrameElement
    if (file.type === 'application/pdf') {
        // PDF loading doesn't work in sandboxes: https://github.com/whatwg/html/issues/3958
        iframe.removeAttribute('sandbox')
    } else if (file.type.startsWith('video/') || file.type.startsWith('audio')) {
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts')
    } else {
        iframe.setAttribute('sandbox', 'allow-same-origin')
    }
    iframe.src = URL.createObjectURL(file)
}

async function init() {
    window.onmessage = (e) => {
        if (e.data.action === 'respondFile') {
            handleFile(e.data.file)
        }
    }

    if (window.parent) {
        window.parent.postMessage({ 'action': 'requestFile' })
    }
}
init()
