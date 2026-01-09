import { IMagickImage } from "@imagemagick/magick-wasm";

export interface MotionPhotoInfo {
    isMotionPhoto: boolean;
    version?: string;
    presentationTimestampUs?: string;
    microVideoOffset?: string;
}

/**
 * Extracts Android Motion Photo information from an image's XMP profile.
 * 
 * @param image The ImageMagick image object to extract XMP profile from.
 * @returns A MotionPhotoInfo object if detected, otherwise null.
 */
export function extractMotionPhotoInfo(image: IMagickImage): MotionPhotoInfo | null {
    const xmpProfile = image.getProfile('xmp');
    let parsedMotionInfo: { version?: string; timestamp?: string; offset?: string; isMotion?: boolean } = {};

    if (xmpProfile) {
        const decoder = new TextDecoder('utf-8');
        const xmpString = decoder.decode(xmpProfile.data);

        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmpString, "text/xml");
            const ns = "http://ns.google.com/photos/1.0/camera/";

            const extract = (tag: string) => {
                // Try to find the attribute in any element (Description usually)
                const descriptions = xmlDoc.getElementsByTagNameNS("*", "Description");
                for (let i = 0; i < descriptions.length; i++) {
                    const attr = descriptions[i].getAttributeNS(ns, tag) || descriptions[i].getAttribute(`GCamera:${tag}`);
                    if (attr) return attr;
                }

                // Try to find it as a direct element
                const elements = xmlDoc.getElementsByTagNameNS(ns, tag) || xmlDoc.getElementsByTagName(`GCamera:${tag}`);
                if (elements.length > 0 && elements[0].textContent) {
                    return elements[0].textContent;
                }
                return undefined;
            };

            parsedMotionInfo = {
                isMotion: extract('MotionPhoto') === '1' || xmpString.includes('MicroVideoOffset'),
                version: extract('MotionPhotoVersion'),
                timestamp: extract('MotionPhotoPresentationTimestampUs'),
                offset: extract('MicroVideoOffset')
            };
        } catch (e) {
            console.error('Failed to parse XMP XML', e);
        }
    }

    if (parsedMotionInfo.isMotion) {
        return {
            isMotionPhoto: true,
            version: parsedMotionInfo.version,
            presentationTimestampUs: parsedMotionInfo.timestamp,
            microVideoOffset: parsedMotionInfo.offset
        };
    }
    return null;
}
