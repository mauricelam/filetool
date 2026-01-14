import { describe, it, expect } from 'vitest';
import { extractLivePhotoInfo, getAppleMakerNoteTags } from "./live-photo";
import type { IMagickImage } from "@imagemagick/magick-wasm";
import * as fs from 'fs';
import * as path from 'path';
import ExifReader from 'exifreader';
import { Buffer } from 'buffer';

/**
 * Creates a mock IMagickImage from a real HEIC file's EXIF data.
 * This approach uses ExifReader to extract the MakerNote from real images,
 * then creates a mock IMagickImage that returns this data through getProfile().
 * This allows us to test against real Live Photo metadata without needing
 * to initialize the full ImageMagick WASM runtime in Node.js.
 */
function createMockImageFromFile(filePath: string): IMagickImage {
    const fileData = fs.readFileSync(filePath);
    const tags = ExifReader.load(fileData);

    // Extract EXIF profile data
    let exifData: Uint8Array | null = null;
    if (tags['MakerNote'] && (tags['MakerNote'] as any).value) {
        // Create a minimal EXIF structure with the MakerNote
        const makerNote = Buffer.from((tags['MakerNote'] as any).value);
        exifData = createExifWithMakerNote(makerNote);
    }

    return {
        getProfile: (name: string) => {
            if (name === 'exif' && exifData) {
                return {
                    data: exifData
                } as any;
            }
            return null as any;
        }
    } as IMagickImage;
}

/**
 * Creates a minimal EXIF structure with the given MakerNote
 */
function createExifWithMakerNote(makerNote: Buffer): Buffer {
    const exifHeader = Buffer.from('Exif\0\0');
    const tiffHeader = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08]); // Big-endian TIFF

    // IFD0 with one entry pointing to EXIF IFD
    const ifd0 = Buffer.alloc(14);
    ifd0.writeUInt16BE(1, 0);           // 1 entry
    ifd0.writeUInt16BE(0x8769, 2);      // EXIF IFD Pointer tag
    ifd0.writeUInt16BE(4, 4);           // Type: Long
    ifd0.writeUInt32BE(1, 6);           // Count: 1
    ifd0.writeUInt32BE(22, 10);         // Offset to EXIF IFD

    // EXIF IFD with MakerNote
    const exifIfdOffset = 22;
    const makerNoteOffset = exifIfdOffset + 14;
    const exifIfd = Buffer.alloc(14);
    exifIfd.writeUInt16BE(1, 0);                    // 1 entry
    exifIfd.writeUInt16BE(0x927c, 2);               // MakerNote tag
    exifIfd.writeUInt16BE(7, 4);                    // Type: Undefined
    exifIfd.writeUInt32BE(makerNote.length, 6);     // Count
    exifIfd.writeUInt32BE(makerNoteOffset, 10);     // Offset to MakerNote data

    return Buffer.concat([exifHeader, tiffHeader, ifd0, exifIfd, makerNote]);
}

describe('extractLivePhotoInfo', () => {
    it('should extract live photo info from IMG_3982.heic', async () => {
        const imagePath = path.join(__dirname, 'examples', 'IMG_3982.heic');
        const mockImage = createMockImageFromFile(imagePath);

        const info = await extractLivePhotoInfo(mockImage);

        expect(info).not.toBeNull();
        expect(info?.type).toBe('livephoto');
        expect(info?.contentIdentifier).toBeDefined();
        expect(typeof info?.contentIdentifier).toBe('string');
        expect(info?.contentIdentifier?.length).toBeGreaterThan(0);
        expect(info?.makerNoteTags.length).toBeGreaterThan(0);

        // Verify ContentIdentifier tag exists
        const contentIdTag = info?.makerNoteTags.find(t => t.id === 0x0011);
        expect(contentIdTag).toBeDefined();
        expect(contentIdTag?.name).toBe('ContentIdentifier');
        expect(contentIdTag?.value).toBe(info?.contentIdentifier);
    });

    it('should return null for iphone_7.heic (has MakerNote but not Live Photo)', async () => {
        const imagePath = path.join(__dirname, 'examples', 'iphone_7.heic');
        const mockImage = createMockImageFromFile(imagePath);

        const info = await extractLivePhotoInfo(mockImage);

        expect(info).toBeNull();
    });

    it('should extract Apple MakerNote tags from iphone_7.heic', async () => {
        const imagePath = path.join(__dirname, 'examples', 'iphone_7.heic');
        const mockImage = createMockImageFromFile(imagePath);

        const tags = getAppleMakerNoteTags(mockImage);

        // Should have some MakerNote tags
        expect(tags.length).toBeGreaterThan(0);

        // Should NOT have ContentIdentifier tag
        const contentIdTag = tags.find(t => t.id === 0x0011);
        expect(contentIdTag).toBeUndefined();

        // Verify tags have proper structure
        tags.forEach(tag => {
            expect(tag).toHaveProperty('id');
            expect(tag).toHaveProperty('name');
            expect(tag).toHaveProperty('raw');
            expect(tag).toHaveProperty('value');
            expect(typeof tag.id).toBe('number');
            expect(typeof tag.name).toBe('string');
        });
    });

    it('should extract multiple MakerNote tags from IMG_3982.heic', async () => {
        const imagePath = path.join(__dirname, 'examples', 'IMG_3982.heic');
        const mockImage = createMockImageFromFile(imagePath);

        const tags = getAppleMakerNoteTags(mockImage);

        // Should have multiple MakerNote tags
        expect(tags.length).toBeGreaterThan(1);

        // Should have ContentIdentifier tag
        const contentIdTag = tags.find(t => t.id === 0x0011);
        expect(contentIdTag).toBeDefined();
        expect(contentIdTag?.name).toBe('ContentIdentifier');
        expect(typeof contentIdTag?.value).toBe('string');

        // Verify all tags have proper structure
        tags.forEach(tag => {
            expect(tag).toHaveProperty('id');
            expect(tag).toHaveProperty('name');
            expect(tag).toHaveProperty('raw');
            expect(tag).toHaveProperty('value');
            expect(typeof tag.id).toBe('number');
            expect(typeof tag.name).toBe('string');
        });
    });
});
