import { parseBuffer } from "./bplist-parser";
import ExifReader from 'exifreader';
import { Buffer } from 'buffer';
import { IMagickImage } from "@imagemagick/magick-wasm";

export interface AppleMakerNoteTag {
    id: number;
    name: string;
    raw: Uint8Array;
    value: any;
}

export interface LivePhotoInfo {
    type: 'livephoto';
    contentIdentifier?: string;
    makerNoteTags: AppleMakerNoteTag[];
    plist?: any;
}

/**
 * Mapping of Apple MakerNote Tag IDs to their human-readable names.
 * Source: https://exiftool.org/TagNames/Apple.html
 */
const APPLE_TAG_NAMES: Record<number, string> = {
    0x0001: "MakerNoteVersion",
    0x0002: "AEMatrix",
    0x0003: "RunTime",
    0x0004: "AEStable",
    0x0005: "AETarget",
    0x0006: "AEAverage",
    0x0007: "AFStable",
    0x0008: "AccelerationVector",
    0x000a: "HDRImageType",
    0x000b: "BurstUUID",
    0x000c: "FocusDistanceRange",
    0x000f: "OISMode",
    0x0010: "SphereStatus",
    0x0011: "ContentIdentifier",
    0x0014: "ImageCaptureType",
    0x0015: "ImageUniqueID",
    0x0017: "LivePhotoVideoIndex",
    0x0019: "MediaGroupUUID",
    0x0020: "PhotoEffectsIdentifier",
    0x0025: "ColorTemperature",
    0x002c: "ImageProcessingFlags",
};

/**
 * Parses raw MakerNote tag data into human-readable values.
 */
function parseAppleTagValue(tagId: number, data: Uint8Array): any {
    const buf = Buffer.from(data);

    // Handle bplist tags (AEMatrix, RunTime, etc.)
    if (buf.slice(0, 6).toString('utf8') === 'bplist') {
        try {
            const parsed = parseBuffer(buf)[0];
            // If parsed result is a Buffer, hex encode it
            if (Buffer.isBuffer(parsed)) {
                return parsed.toString('hex');
            }
            // Post-process RunTime (Tag 0x0003) which is a CMTime structure in bplist
            if (tagId === 0x0003 && parsed && typeof parsed.value === 'number') {
                const seconds = parsed.value / (parsed.timescale || 1);
                return { ...parsed, readable: `${seconds.toFixed(3)}s` };
            }
            return parsed;
        } catch (e) {
            return buf.toString('hex');
        }
    }

    // Handle AccelerationVector (Tag 0x0008) - rational64s[3]
    if (tagId === 0x0008 && buf.length >= 24) {
        const coords = [];
        for (let i = 0; i < 3; i++) {
            const num = buf.readInt32BE(i * 8);
            const den = buf.readInt32BE(i * 8 + 4);
            coords.push(den === 0 ? 0 : num / den);
        }
        return { x: coords[0], y: coords[1], z: coords[2], unit: 'g' };
    }

    // Handle String types
    if ([0x000b, 0x0011, 0x0015, 0x0019].includes(tagId)) {
        return buf.toString('utf8').replace(/\0/g, '').trim();
    }

    // Handle simple Integers
    if (data.length <= 4) {
        if (data.length === 2) return buf.readUInt16BE(0);
        if (data.length === 4) return buf.readUInt32BE(0);
    }

    return buf.toString('hex');
}

/**
 * Part 1: Extracts a map of Apple MakerNote tags from an IMagickImage.
 */
export function getAppleMakerNoteTags(image: IMagickImage): AppleMakerNoteTag[] {
    const results: AppleMakerNoteTag[] = [];
    try {
        const exifProfile = image.getProfile('exif');
        if (!exifProfile || !exifProfile.data) return [];

        let rawData = Buffer.from(exifProfile.data);
        if (rawData.slice(0, 4).toString('utf8') === 'Exif') {
            rawData = rawData.slice(6);
        }

        const tags = ExifReader.load(rawData);
        const makerNoteTag = tags['MakerNote'];
        if (!makerNoteTag || !(makerNoteTag as any).value) return [];

        const makerNote = Buffer.from((makerNoteTag as any).value);
        if (makerNote.slice(0, 10).toString('utf8') !== 'Apple iOS\0') return [];

        const ifdOffset = 14;
        const numEntries = makerNote.readUInt16BE(ifdOffset);

        for (let i = 0; i < numEntries; i++) {
            const entryOffset = ifdOffset + 2 + (i * 12);
            const tagId = makerNote.readUInt16BE(entryOffset);
            const type = makerNote.readUInt16BE(entryOffset + 2);
            const count = makerNote.readUInt32BE(entryOffset + 4);
            const valueOffset = makerNote.readUInt32BE(entryOffset + 8);

            let componentSize = 1;
            switch (type) {
                case 3: componentSize = 2; break; // Short
                case 4: case 9: componentSize = 4; break; // Long / SLong
                case 5: case 10: componentSize = 8; break; // Rational / SRational
            }

            const totalSize = count * componentSize;
            let data: Uint8Array;

            if (totalSize <= 4) {
                data = makerNote.slice(entryOffset + 8, entryOffset + 8 + totalSize);
            } else if (valueOffset + totalSize <= makerNote.length) {
                data = makerNote.slice(valueOffset, valueOffset + totalSize);
            } else {
                continue;
            }

            results.push({
                id: tagId,
                name: APPLE_TAG_NAMES[tagId] || `Unknown_0x${tagId.toString(16)}`,
                raw: data,
                value: parseAppleTagValue(tagId, data)
            });
        }
    } catch (e) {
        console.error('MakerNote extraction error:', e);
    }
    return results;
}

/**
 * Part 2: Specialized extractor for Live Photo info from the MakerNote.
 */
export async function extractLivePhotoInfo(image: IMagickImage): Promise<LivePhotoInfo | null> {
    const makerNoteTags = getAppleMakerNoteTags(image);
    if (makerNoteTags.length === 0) return null;

    let contentIdentifier: string | undefined;
    let mainPlist: any;

    // First check direct ContentIdentifier tag (0x0011)
    const directTag = makerNoteTags.find(t => t.id === 0x0011);
    if (directTag && typeof directTag.value === 'string') {
        contentIdentifier = directTag.value;
    }

    // Only return if we found metadata indicating a Live Photo context
    if (contentIdentifier) {
        return {
            type: 'livephoto',
            contentIdentifier,
            makerNoteTags,
            plist: mainPlist
        };
    }

    return null;
}