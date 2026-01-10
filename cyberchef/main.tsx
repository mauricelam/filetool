import { RespondFileMessage } from "filemagic-common/messages";

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' }, '/');
}

window.onmessage = (e: MessageEvent<RespondFileMessage>) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const OUTPUT = document.getElementById('output')

async function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const dataUrl = event.target?.result as string;
        // remove the "data:*/*;base64," prefix
        const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);

        const iframe = document.createElement('iframe');
        iframe.id = 'cyberchef';
        iframe.src = `/cyberchef/CyberChef/CyberChef_v10.19.4.html#input=${encodeURIComponent(base64)}`;
        OUTPUT?.appendChild(iframe);
    };
    reader.readAsDataURL(file);
}
