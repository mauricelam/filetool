import { readEml } from 'eml-parse-js';
import { ParsedEmlJson, ReadedEmlJson } from 'eml-parse-js/dist/interface';
import { safeReadFile } from '@filetool/common';

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' });
}

window.onmessage = (e) => {
    if (e.data && e.data.action === 'respondFile') {
        handleFile(e.data.file);
    }
};

const IFRAME = document.getElementById('iframe') as HTMLIFrameElement;

async function handleFile(file: File) {
    if (!('sandbox' in IFRAME)) {
        (IFRAME as HTMLIFrameElement).srcdoc = "Unable to display. Sandboxing not supported by browser";
        return;
    }

    try {
        const { buffer } = await safeReadFile(file, { maxBytes: 50 * 1024 * 1024 });
        const textDecoder = new TextDecoder('utf-8', { fatal: false });
        const htmlContents = textDecoder.decode(buffer);
        const contents = await asyncReadEml(htmlContents);
        IFRAME.srcdoc = contents.html || htmlContents;
    } catch (err) {
        console.error('Error handling MHTML file:', err);
        IFRAME.srcdoc = `<p style="color: red; padding: 20px;">Failed to parse MHTML document: ${(err as Error).message || err}</p>`;
    }
}

function asyncReadEml(eml: string | ParsedEmlJson, options = null): Promise<ReadedEmlJson> {
    return new Promise((resolve, reject) => {
        readEml(eml, options, (err, parsed) => {
            if (err) {
                return reject(err);
            }
            return resolve(parsed);
        });
    });
}
