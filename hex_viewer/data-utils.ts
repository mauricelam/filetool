export function readInt8(buffer: Uint8Array, offset: number): number {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getInt8(offset);
}

export function readUint8(buffer: Uint8Array, offset: number): number {
    return buffer[offset];
}

export function readInt16(buffer: Uint8Array, offset: number, littleEndian: boolean): number {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getInt16(offset, littleEndian);
}

export function readUint16(buffer: Uint8Array, offset: number, littleEndian: boolean): number {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint16(offset, littleEndian);
}

export function readInt32(buffer: Uint8Array, offset: number, littleEndian: boolean): number {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getInt32(offset, littleEndian);
}

export function readUint32(buffer: Uint8Array, offset: number, littleEndian: boolean): number {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(offset, littleEndian);
}

export function readBigInt64(buffer: Uint8Array, offset: number, littleEndian: boolean): bigint {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getBigInt64(offset, littleEndian);
}

export function readBigUint64(buffer: Uint8Array, offset: number, littleEndian: boolean): bigint {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getBigUint64(offset, littleEndian);
}

export function readFloat32(buffer: Uint8Array, offset: number, littleEndian: boolean): number {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getFloat32(offset, littleEndian);
}

export function readFloat64(buffer: Uint8Array, offset: number, littleEndian: boolean): number {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getFloat64(offset, littleEndian);
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
