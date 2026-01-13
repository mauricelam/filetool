import { IMagickImage } from "@imagemagick/magick-wasm";
import { Buffer } from "buffer";
import { parseBuffer } from "./bplist-parser";

export interface LivePhotoInfo {
    isLivePhoto: boolean;
    contentIdentifier?: string;
    plist?: any;
}

/**
 * Extracts Apple Live Photo information from an image's EXIF MakerNote.
 *
 * @param image The ImageMagick image object to extract EXIF profile from.
 * @returns A LivePhotoInfo object if detected, otherwise null.
 */
export function extractLivePhotoInfo(image: IMagickImage): LivePhotoInfo | null {
    const makerNoteBase64 = image.getAttribute('exif:MakerNote');
    if (!makerNoteBase64) {
        return null;
    }

    try {
        const makerNote = Buffer.from(makerNoteBase64, 'base64');
        const plistArray = parseBuffer(makerNote);
        const plist = plistArray[0];

        if (plist && plist['ContentIdentifier']) {
            return {
                isLivePhoto: true,
                contentIdentifier: plist['ContentIdentifier'],
                plist: plist,
            };
        }
    } catch (e) {
        console.error('Failed to parse MakerNote as bplist', e);
    }

    return null;
}
