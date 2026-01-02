import loader from "@binutils-wasm/binutils";

// const UTIL_ARGS = {
//     objdump: (f: string) => ['-f', f],
//     nm: (f: string) => [f],
//     strings: (f: string) => [f],
//     readelf: (f: string) => ['-a', f],
//     size: (f: string) => ['--format=SysV', f],
// }

self.onmessage = (e: MessageEvent) => {
    console.log('Running util', e.data.action, e.data.flags)
    run_binutil(e.data.action, e.data.flags, e.data.file, (line) => {
        self.postMessage(line)
    })
}

async function run_binutil(util: string, flags: string[], file: File, callback: (line: string) => void) {
    const wasm_fn = await loader(util as any);
    const fileBytes = await file.arrayBuffer();
    await wasm_fn({
        print: callback,
        printErr: (line) => callback(`ERROR: ${line}`),
        arguments: [...flags, file.name],
        preRun: [(m) => {
            m.FS.writeFile(file.name, new Uint8Array(fileBytes));
        }],
    })
}
