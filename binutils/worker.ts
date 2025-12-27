import loader from "@binutils-wasm/binutils";

const UTIL_ARGS: { [key: string]: (f: string, flags?: string[]) => string[] } = {
    objdump: (f: string, flags: string[] = []) => ['-f', ...flags, f],
    nm: (f: string, flags: string[] = []) => [...flags, f],
    strings: (f: string, flags: string[] = []) => [...flags, f],
    readelf: (f: string, flags: string[] = []) => ['-a', ...flags, f],
    size: (f: string, flags: string[] = []) => ['--format=SysV', ...flags, f],
};

self.onmessage = (e: MessageEvent) => {
    if (e.data.action in UTIL_ARGS) {
        console.log('Running util', e.data.action, 'with flags', e.data.flags)
        run_binutil(e.data.action, e.data.file, e.data.flags || [], (line) => {
            self.postMessage(line)
        })
    } else {
        console.warn('Unknown action', e.data.action)
    }
}

async function run_binutil(util: string, file: File, flags: string[], callback: (line: string) => void) {
    const wasm_fn = await loader(util as any);
    const fileBytes = await file.arrayBuffer();
    await wasm_fn({
        print: callback,
        printErr: (line) => callback(`ERROR: ${line}`),
        arguments: UTIL_ARGS[util](file.name, flags),
        preRun: [(m) => {
            m.FS.writeFile(file.name, new Uint8Array(fileBytes));
        }],
    })
}
