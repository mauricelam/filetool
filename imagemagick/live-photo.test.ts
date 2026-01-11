import { describe, it, expect } from 'vitest';
import { IMagickImage } from "@imagemagick/magick-wasm";
import { extractLivePhotoInfo } from "./live-photo";

describe('extractLivePhotoInfo', () => {
    it('should return null if xmp profile is not present', () => {
        const mockImage = {
            getProfile: (_: string) => null
        } as unknown as IMagickImage;
        expect(extractLivePhotoInfo(mockImage)).toBeNull();
    });

    it('should return null if xmp does not contain live photo info', () => {
        const xmpData = `
        <x:xmpmeta xmlns:x="adobe:ns:meta/">
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
            <rdf:Description rdf:about=""/>
          </rdf:RDF>
        </x:xmpmeta>
        `;
        const mockImage = {
            getProfile: (_: string) => ({ data: new TextEncoder().encode(xmpData) })
        } as unknown as IMagickImage;
        expect(extractLivePhotoInfo(mockImage)).toBeNull();
    });

    it('should extract live photo info from apple_photos attributes', () => {
        const assetId = "A1B2C3D4-E5F6-G7H8-I9J0-K1L2M3N4O5P6";
        const xmpData = `
        <x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 5.4.0">
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
            <rdf:Description rdf:about=""
              xmlns:apple_photos="http://ns.apple.com/photos/1.0/camera/"
              apple_photos:AssetIdentifier="${assetId}" />
          </rdf:RDF>
        </x:xmpmeta>
        `;
        const mockImage = {
            getProfile: (_: string) => ({ data: new TextEncoder().encode(xmpData) })
        } as unknown as IMagickImage;

        const info = extractLivePhotoInfo(mockImage);
        expect(info).not.toBeNull();
        expect(info?.isLivePhoto).toBe(true);
        expect(info?.assetIdentifier).toBe(assetId);
    });
});
