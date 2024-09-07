import wabt from "wabt"

self.onmessage = async (e) => {
    console.log('message', e)
    if (e.data.action === 'fileToWat') {
        const wat = await fileToWat(e.data.file)
        self.postMessage(wat)
    } else {
        throw new Error(`Unknown action ${e.data.action}`)
    }
}

async function fileToWat(file: File): Promise<string> {
    const wabtool = await wabt()
    const module = wabtool.readWasm(new Uint8Array(await file.arrayBuffer()), {})
    return module.toText({})
}
