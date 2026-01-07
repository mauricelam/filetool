// 1. Get handler from URL and set iframe src
const params = new URLSearchParams(window.location.search);
const handler = params.get('handler');
const iframeEl = document.getElementById('file-handler-iframe') as HTMLIFrameElement;
if (handler) {
    iframeEl.src = `/${handler}/index.html`;
}

let fileToProvide: File | null = null;
let handlerIsReady = false;

function sendFileIfReady() {
    console.log('sendFileIfReady called', { fileToProvide, handlerIsReady });
    if (fileToProvide && handlerIsReady && iframeEl.contentWindow) {
        console.log('Sending file to handler');
        iframeEl.contentWindow.postMessage({
            action: 'respondFile',
            file: fileToProvide
        }, '*');
    }
}

// 2. Listen for file data from the test runner (parent window)
window.addEventListener('message', (event: MessageEvent) => {
    console.log('Message received from parent', event.data);
    if (event.source === window.parent && event.data.action === 'setFile') {
        const { content, name, type, encoding } = event.data.file;
        let fileContent: BlobPart;

        if (encoding === 'base64') {
            const binaryString = window.atob(content);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            fileContent = bytes;
        } else {
            fileContent = content;
        }

        fileToProvide = new File([fileContent], name, { type });
        sendFileIfReady();
    }
});

// 3. Listen for the ready signal from the handler iframe
window.addEventListener('message', (event: MessageEvent) => {
    console.log('Message received from iframe', event.data);
    if (event.source === iframeEl.contentWindow && event.data.action === 'requestFile') {
        handlerIsReady = true;
        sendFileIfReady();
    }
});
