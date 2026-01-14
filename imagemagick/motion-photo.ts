import { IMagickImage } from "@imagemagick/magick-wasm";

export interface MotionPhotoInfo {
    type: 'motionphoto';
    version?: string;
    presentationTimestampUs?: string;
    microVideoOffset?: string;
}

/**
 * Extracts Android Motion Photo information from an image's XMP profile.
 * 
 * https://developer.android.com/media/platform/motion-photo-format
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
            const nsGCamera = "http://ns.google.com/photos/1.0/camera/";
            const nsContainer = "http://ns.google.com/photos/1.0/container/";
            const nsItem = "http://ns.google.com/photos/1.0/container/item/";

            const extractGCamera = (tag: string) => {
                const descriptions = xmlDoc.getElementsByTagNameNS("*", "Description");
                for (let i = 0; i < descriptions.length; i++) {
                    const attr = descriptions[i].getAttributeNS(nsGCamera, tag) || descriptions[i].getAttribute(`GCamera:${tag}`);
                    if (attr) return attr;
                }
                const elements = xmlDoc.getElementsByTagNameNS(nsGCamera, tag) || xmlDoc.getElementsByTagName(`GCamera:${tag}`);
                if (elements.length > 0 && elements[0].textContent) return elements[0].textContent;
                return undefined;
            };

            // Try the new Container:Directory format first
            let containerOffset: string | undefined;
            const allElements = xmlDoc.getElementsByTagName("*");
            for (const el of Array.from(allElements)) {
                if (el.localName === "Item") {
                    const semantic = el.getAttributeNS(nsItem, "Semantic") || el.getAttribute("Item:Semantic") || el.getAttribute("Semantic");
                    if (semantic === "MotionPhoto") {
                        containerOffset = el.getAttributeNS(nsItem, "Length") || el.getAttribute("Item:Length") || el.getAttribute("Length") || undefined;
                        break;
                    }
                }
            }

            parsedMotionInfo = {
                isMotion: extractGCamera('MotionPhoto') === '1' || !!containerOffset || xmpString.includes('MicroVideoOffset'),
                version: extractGCamera('MotionPhotoVersion'),
                timestamp: extractGCamera('MotionPhotoPresentationTimestampUs'),
                offset: containerOffset || extractGCamera('MicroVideoOffset')
            };
        } catch (e) {
            console.error('Failed to parse XMP XML', e);
        }
    }

    if (parsedMotionInfo.isMotion) {
        return {
            type: 'motionphoto',
            version: parsedMotionInfo.version,
            presentationTimestampUs: parsedMotionInfo.timestamp,
            microVideoOffset: parsedMotionInfo.offset
        };
    }
    return null;
}
