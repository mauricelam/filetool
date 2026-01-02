import loader from "@binutils-wasm/binutils";

const UTIL_ARGS = {
    objdump: (f: string) => ['-f', f],
    nm: (f: string) => [f],
    strings: (f: string) => [f],
    readelf: (f: string) => ['-a', f],
    size: (f: string) => ['--format=SysV', f],
}

self.onmessage = (e: MessageEvent) => {
    if (e.data.action in UTIL_ARGS) {
        console.log('Running util', e.data.action)
        run_binutil(e.data.action, e.data.file, (line) => {
            self.postMessage(line)
        })
    } else {
        console.warn('Unknown action', e.data.action)
    }
}

async function run_binutil(util: string, file: File, callback: (line: string) => void) {
    const wasm_fn = await loader(util as any);
    const fileBytes = await file.arrayBuffer();
    await wasm_fn({
        print: callback,
        printErr: (line) => callback(`ERROR: ${line}`),
        arguments: UTIL_ARGS[util](file.name),
        preRun: [(m) => {
            m.FS.writeFile(file.name, new Uint8Array(fileBytes));
        }],
    })
}
