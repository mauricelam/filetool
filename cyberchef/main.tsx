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
    const iframe = document.createElement('iframe');
    iframe.id = 'cyberchef';
    iframe.src = `/cyberchef/CyberChef/CyberChef_v10.19.4.html`;

    iframe.onload = async () => {
        try {
            await setCyberchefInputFile(iframe, file);
        } catch (error) {
            console.error('Failed to trigger drag and drop:', error);
        }
    };

    OUTPUT?.appendChild(iframe);
}

/**
 * Set the input file for CyberChef.
 * 
 * Programmatically set the file on the input element. We are not using the URL parameter because it has a length limit
 * that are often too short for file inputs.
 */
async function setCyberchefInputFile(iframe: HTMLIFrameElement, file: File) {
    // Wait for the iframe content to be fully loaded
    const iframeWindow = iframe.contentWindow;
    const iframeDoc = iframe.contentDocument || iframeWindow?.document;
    if (!iframeDoc || !iframeWindow) {
        throw new Error('Cannot access iframe document or window');
    }

    let inputWrapper: HTMLInputElement | null = null;

    for (let i = 0; i < 100; i++) {
        inputWrapper = iframeDoc.getElementById('open-file') as HTMLInputElement | null;
        if (inputWrapper) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!inputWrapper) {
        throw new Error('Could not find element with id="input-wrapper"');
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    inputWrapper.files = dataTransfer.files;
    inputWrapper.dispatchEvent(new Event('change'));
}
