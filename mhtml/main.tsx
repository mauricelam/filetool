import { readEml, parseEml } from 'eml-parse-js';
import { ParsedEmlJson, ReadedEmlJson } from 'eml-parse-js/dist/interface';

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const IFRAME = document.getElementById('iframe') as HTMLIFrameElement

async function handleFile(file: File) {
    if (!('sandbox' in IFRAME)) {
        (IFRAME as HTMLIFrameElement).srcdoc = "Unable to display. Sandboxing not supported by browser"
        return
    }

    let htmlContents = await file.text()
    const contents = await asyncReadEml(htmlContents)
    console.log(contents);
    IFRAME.srcdoc = contents.html
}

function asyncReadEml(eml: string | ParsedEmlJson, options = null): Promise<ReadedEmlJson> {
    return new Promise((resolve, reject) => {
        readEml(eml, options, (err, parsed) => {
            if (err) {
                return reject(err)
            }
            return resolve(parsed)
        })
    })
}

function asyncParseEml(eml: string, options = null): Promise<ParsedEmlJson> {
    return new Promise((resolve, reject) => {
        parseEml(eml, options, (err, parsed) => {
            if (err) {
                return reject(err)
            }
            return resolve(parsed)
        })
    })
}
