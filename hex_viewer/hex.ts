// Modified from https://github.com/gagle/node-hex

function zero(n: number, max: number) {
    let padded = n.toString(16).toUpperCase();
    while (padded.length < max) {
        padded = '0' + padded;
    }
    return padded;
}

export default async function* (buffer: Uint8Array): AsyncGenerator<[string, string, string]> {
    const rows = Math.ceil(buffer.length / 16);
    const last = buffer.length % 16 || 16;
    let offsetLength = buffer.length.toString(16).length;
    if (offsetLength < 6) offsetLength = 6;

    let b = 0;

    for (let i = 0; i < rows; i++) {
        const offsetStr = zero(b, offsetLength);
        const lastBytes = i === rows - 1 ? last : 16;
        let hex = ''
        let ascii = ''

        for (let j = 0; j < lastBytes; j++) {
            const v = buffer[b];
            const isAscii = (v > 31 && v < 127) || v > 159;
            let className = ""
            if (isAscii) {
                className = "char_ascii"
            } else if (v == 0) {
                className = "char_null"
            } else {
                className = "char_unknown"
            }
            hex += `<span class="${className}"> ${zero(v, 2)}</span>`;
            ascii += `<span class="${className}">${isAscii ? String.fromCharCode(v) : '.'}</span>`;
            b++;
        }
        yield [offsetStr, hex, ascii]
    }
};
