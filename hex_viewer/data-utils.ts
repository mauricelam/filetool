export function getDataView(buffer: Uint8Array): DataView {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export function readVarint(buffer: Uint8Array, offset: number): { value: bigint; length: number } {
    let result = BigInt(0);
    let shift = BigInt(0);
    let length = 0;
    while (offset + length < buffer.length) {
        const byte = buffer[offset + length];
        result |= BigInt(byte & 0x7f) << shift;
        length++;
        if ((byte & 0x80) === 0) {
            break;
        }
        shift += BigInt(7);
    }
    return { value: result, length };
}
