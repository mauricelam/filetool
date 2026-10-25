import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from "../../tests/fixtures";
import { extractGnuDebugdata } from '../src/symbolExtractor.ts';

test.describe('Ghidra Symbol Extractor', () => {
    test('extractGnuDebugdata extracts section from libcodec2.so', async () => {
        const fixturePath = path.resolve('ghidra/example/libcodec2.so');
        const buffer = fs.readFileSync(fixturePath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const gnuDebugdata = extractGnuDebugdata(arrayBuffer);
        expect(gnuDebugdata).not.toBeNull();
        expect(gnuDebugdata!.byteLength).toBeGreaterThan(0);

        // Verify XZ magic bytes (FD 37 7A 58 5A 00)
        const u8 = new Uint8Array(gnuDebugdata!);
        expect(u8[0]).toBe(0xfd);
        expect(u8[1]).toBe(0x37);
        expect(u8[2]).toBe(0x7a);
        expect(u8[3]).toBe(0x58);
        expect(u8[4]).toBe(0x5a);
        expect(u8[5]).toBe(0x00);
    });

    test('extractGnuDebugdata returns null for binary without .gnu_debugdata', async () => {
        const fixturePath = path.resolve('binutils/example/libhello.so');
        const buffer = fs.readFileSync(fixturePath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const gnuDebugdata = extractGnuDebugdata(arrayBuffer);
        expect(gnuDebugdata).toBeNull();
    });

    test('extractGnuDebugdata returns null for non-ELF or empty buffer', async () => {
        const emptyBuffer = new ArrayBuffer(0);
        expect(extractGnuDebugdata(emptyBuffer)).toBeNull();

        const invalidElf = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
        expect(extractGnuDebugdata(invalidElf)).toBeNull();
    });
});
