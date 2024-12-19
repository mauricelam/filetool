const CheerpJ = window as any;

async function handleFile(file: File) {
    console.log('Adding file', file, 'to Cheerp', `/str/${file.name}`)
    CheerpJ.cheerpOSAddStringFile(`/str/${file.name}`, new Uint8Array(await file.arrayBuffer()))
    // https://cheerpj.com/docs/guides/File-System-support.html
    await CheerpJ.cheerpjRunJar(`/str/${file.name}`);
}

async function init() {
    await CheerpJ.cheerpjInit();
    CheerpJ.cheerpjCreateDisplay(-1, -1, document.body);

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
