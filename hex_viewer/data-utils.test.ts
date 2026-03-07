import { readInt8, readUint8, readInt16, readUint16, readInt32, readUint32, readBigInt64, readBigUint64, readFloat32, readFloat64, readVarint } from './data-utils';

describe('data-utils', () => {
    const buffer = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x80, 0x01]);

    test('readInt8', () => {
        expect(readInt8(buffer, 0)).toBe(1);
        expect(readInt8(new Uint8Array([0xff]), 0)).toBe(-1);
    });

    test('readUint8', () => {
        expect(readUint8(buffer, 0)).toBe(1);
    });

    test('readInt16', () => {
        expect(readInt16(buffer, 0, true)).toBe(0x0201);
        expect(readInt16(buffer, 0, false)).toBe(0x0102);
    });

    test('readUint16', () => {
        expect(readUint16(buffer, 0, true)).toBe(0x0201);
        expect(readUint16(buffer, 0, false)).toBe(0x0102);
    });

    test('readInt32', () => {
        expect(readInt32(buffer, 0, true)).toBe(0x04030201);
        expect(readInt32(buffer, 0, false)).toBe(0x01020304);
    });

    test('readUint32', () => {
        expect(readUint32(buffer, 0, true)).toBe(0x04030201 >>> 0);
        expect(readUint32(buffer, 0, false)).toBe(0x01020304 >>> 0);
    });

    test('readBigInt64', () => {
        expect(readBigInt64(buffer, 0, true)).toBe(0x0807060504030201n);
        expect(readBigInt64(buffer, 0, false)).toBe(0x0102030405060708n);
    });

    test('readBigUint64', () => {
        expect(readBigUint64(buffer, 0, true)).toBe(0x0807060504030201n);
        expect(readBigUint64(buffer, 0, false)).toBe(0x0102030405060708n);
    });

    test('readVarint', () => {
        expect(readVarint(buffer, 0)).toEqual({ value: 1n, length: 1 });
        expect(readVarint(buffer, 8)).toEqual({ value: 128n, length: 2 });
    });
});
