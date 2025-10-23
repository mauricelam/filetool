// 1. Get handler from URL and set iframe src
const params = new URLSearchParams(window.location.search);
const handler = params.get('handler');
const iframeEl = document.getElementById('file-handler-iframe');
if (handler) {
    iframeEl.src = `/${handler}/index.html`;
}

let fileToProvide = null;
let handlerIsReady = false;

function sendFileIfReady() {
    if (fileToProvide && handlerIsReady) {
        iframeEl.contentWindow.postMessage({
            action: 'respondFile',
            file: fileToProvide
        }, '*');
    }
}

// 2. Listen for file data from the test runner (parent window)
window.addEventListener('message', (event) => {
    if (event.source === window.parent && event.data.action === 'setFile') {
        const { content, name, type } = event.data.file;
        fileToProvide = new File([content], name, { type });
        sendFileIfReady();
    }
});

// 3. Listen for the ready signal from the handler iframe
window.addEventListener('message', (event) => {
    if (event.source === iframeEl.contentWindow && event.data.action === 'requestFile') {
        handlerIsReady = true;
        sendFileIfReady();
    }
});