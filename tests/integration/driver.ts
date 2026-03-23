// 1. Get handler from URL
const params = new URLSearchParams(window.location.search);
const handler = params.get('handler');
const iframeEl = document.getElementById('file-handler-iframe') as HTMLIFrameElement;

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
        const { content, name, type } = event.data.file;
        const fileContent = content;

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

// 4. Set iframe src after all listeners are registered
if (handler) {
    iframeEl.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms');
    iframeEl.src = `/filetool/${handler}/index.html`;
}
