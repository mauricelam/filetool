// webcodecs.test.ts
import { getH264AnnexBHeaders, generateIVFHeader } from './webcodecs';

describe('WebCodecs Header Generation', () => {
    describe('getH264AnnexBHeaders', () => {
        it('should correctly parse avcC description and prepend start codes', () => {
            // Mock an avcC description based on the ISO 14496-15 spec
            // configurationVersion: 1
            // AVCProfileIndication: 0x4D (Main)
            // profile_compatibility: 0x40
            // AVCLevelIndication: 0x1F (3.1)
            // lengthSizeMinusOne: 3 (4 bytes)
            // numOfSequenceParameterSets: 1
            const sps = new Uint8Array([0x67, 0x42, 0x00, 0x1E]); // Mock SPS
            const pps = new Uint8Array([0x68, 0xCE, 0x3C, 0x80]); // Mock PPS

            const description = new Uint8Array(5 + 1 + 2 + sps.length + 1 + 2 + pps.length);
            const view = new DataView(description.buffer);
            description[0] = 1; // version
            description[1] = 0x4D; // profile
            description[2] = 0x40; // compatibility
            description[3] = 0x1F; // level
            description[4] = 0xFF; // lengthSizeMinusOne = 3

            let pos = 5;
            description[pos++] = 0xE1; // 1 SPS
            view.setUint16(pos, sps.length);
            pos += 2;
            description.set(sps, pos);
            pos += sps.length;

            description[pos++] = 1; // 1 PPS
            view.setUint16(pos, pps.length);
            pos += 2;
            description.set(pps, pos);

            const result = getH264AnnexBHeaders(description.buffer);

            // Check for SPS start code and data
            expect(result.slice(0, 4)).toEqual(new Uint8Array([0, 0, 0, 1]));
            expect(result.slice(4, 8)).toEqual(sps);

            // Check for PPS start code and data
            const ppsStart = 4 + sps.length;
            expect(result.slice(ppsStart, ppsStart + 4)).toEqual(new Uint8Array([0, 0, 0, 1]));
            expect(result.slice(ppsStart + 4, ppsStart + 8)).toEqual(pps);
        });
    });

    describe('generateIVFHeader', () => {
        it('should create a valid 32-byte IVF header', () => {
            const config = {
                codec: 'vp09.00.51.08',
                width: 1920,
                height: 1080
            };
            const totalFrames = 300;
            const duration = 10; // 10 seconds (30 fps)

            const buffer = generateIVFHeader(config, totalFrames, duration);
            const view = new DataView(buffer);

            // Signature "DKIF"
            expect(view.getUint8(0)).toBe(0x44); // D
            expect(view.getUint8(1)).toBe(0x4b); // K
            expect(view.getUint8(2)).toBe(0x49); // I
            expect(view.getUint8(3)).toBe(0x46); // F

            // Version 0
            expect(view.getUint16(4, true)).toBe(0);

            // Header length 32
            expect(view.getUint16(6, true)).toBe(32);

            // FourCC "VP90"
            expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe('VP90');

            // Dimensions
            expect(view.getUint16(12, true)).toBe(1920);
            expect(view.getUint16(14, true)).toBe(1080);

            // Framerate metadata
            // We now use fixed 1000/1 (ms) timebase
            expect(view.getUint32(16, true)).toBe(1000); // rate
            expect(view.getUint32(20, true)).toBe(1);    // scale

            // Total frames
            expect(view.getUint32(24, true)).toBe(300);
        });

        it('should use VP80 FourCC for VP8', () => {
            const config = { codec: 'vp8', width: 640, height: 480 };
            const buffer = generateIVFHeader(config, 100, 4);
            const view = new DataView(buffer);
            expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe('VP80');
        });
    });
});
