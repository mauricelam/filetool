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
    run_binutil(e.data.action, e.data.flags, e.data.buffer, e.data.fileName, (line) => {
        self.postMessage(line)
    })
}

async function run_binutil(util: string, flags: string[], buffer: ArrayBuffer, fileName: string, callback: (line: string) => void) {
    const wasm_fn = await loader(util as any);
    await wasm_fn({
        print: callback,
        printErr: (line) => callback(`ERROR: ${line}`),
        arguments: [...flags, fileName],
        preRun: [(m) => {
            m.FS.writeFile(fileName, new Uint8Array(buffer));
        }],
    })
}
