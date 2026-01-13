import { describe, it, expect, vi } from 'vitest';
import { IMagickImage } from "@imagemagick/magick-wasm";
import { extractLivePhotoInfo } from "./live-photo";
import { parseBuffer } from './bplist-parser';

vi.mock('./bplist-parser', () => ({
    parseBuffer: vi.fn(),
}));

describe('extractLivePhotoInfo', () => {
    it('should return null if maker note is not present', () => {
        const mockImage = {
            getAttribute: (_: string) => null
        } as unknown as IMagickImage;
        expect(extractLivePhotoInfo(mockImage)).toBeNull();
    });

    it('should return null if maker note is not a valid bplist', () => {
        const mockImage = {
            getAttribute: (_: string) => 'invalid-base64-string'
        } as unknown as IMagickImage;
        (parseBuffer as vi.Mock).mockImplementation(() => {
            throw new Error('Invalid bplist');
        });
        expect(extractLivePhotoInfo(mockImage)).toBeNull();
    });

    it('should extract live photo info from maker note', () => {
        const contentId = "A1B2C3D4-E5F6-G7H8-I9J0-K1L2M3N4O5P6";
        const mockImage = {
            getAttribute: (_: string) => 'valid-bplist-string' // The string itself doesn't matter as we're mocking the parser
        } as unknown as IMagickImage;

        (parseBuffer as vi.Mock).mockReturnValue([{
            'ContentIdentifier': contentId
        }]);

        const info = extractLivePhotoInfo(mockImage);
        expect(info).not.toBeNull();
        expect(info?.isLivePhoto).toBe(true);
        expect(info?.contentIdentifier).toBe(contentId);
        expect(info?.plist).toBeDefined();
    });
});
