import { RequestFileMessage, RespondFileMessage } from 'common/messages';

const CheerpJ = window as any;

async function handleFile(file: File) {
    console.log('Adding file', file, 'to Cheerp', `/str/${file.name}`)
    const MAX_CHEERPJ_SIZE = 100 * 1024 * 1024;
    const slice = file.size > MAX_CHEERPJ_SIZE ? file.slice(0, MAX_CHEERPJ_SIZE) : file;
    CheerpJ.cheerpOSAddStringFile(`/str/${file.name}`, new Uint8Array(await slice.arrayBuffer()))
    // https://cheerpj.com/docs/guides/File-System-support.html
    await CheerpJ.cheerpjRunJar(`/str/${file.name}`);
}

async function init() {
    await CheerpJ.cheerpjInit();
    CheerpJ.cheerpjCreateDisplay(-1, -1, document.body);

    window.onmessage = (e: MessageEvent<RespondFileMessage>) => {
        if (e.data.action === 'respondFile') {
            handleFile(e.data.file)
        }
    }

    if (window.parent) {
        window.parent.postMessage({ 'action': 'requestFile' });
    }
}
init()
