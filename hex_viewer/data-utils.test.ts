import { getDataView, readVarint } from './data-utils';

describe('data-utils', () => {
    const buffer = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x80, 0x01]);

    test('getDataView', () => {
        const view = getDataView(buffer);
        expect(view.getUint8(0)).toBe(1);
        expect(view.getUint32(0, true)).toBe(0x04030201);
    });

    test('readVarint', () => {
        expect(readVarint(buffer, 0)).toEqual({ value: 1n, length: 1 });
        expect(readVarint(buffer, 8)).toEqual({ value: 128n, length: 2 });
    });
});
