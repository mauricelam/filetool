import { IMagickImage } from "@imagemagick/magick-wasm";

export interface LivePhotoInfo {
    isLivePhoto: boolean;
    assetIdentifier?: string;
}

/**
 * Extracts Apple Live Photo information from an image's XMP profile.
 *
 * https://www.whexy.com/dyn/ec968903-2fab-44ac-8003-62d14cacc2f5
 *
 * @param image The ImageMagick image object to extract XMP profile from.
 * @returns A LivePhotoInfo object if detected, otherwise null.
 */
export function extractLivePhotoInfo(image: IMagickImage): LivePhotoInfo | null {
    const xmpProfile = image.getProfile('xmp');
    let parsedLiveInfo: { assetIdentifier?: string; isLive?: boolean } = {};

    if (xmpProfile) {
        const decoder = new TextDecoder('utf-8');
        const xmpString = decoder.decode(xmpProfile.data);

        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmpString, "text/xml");
            const nsApple = "http://ns.apple.com/photos/1.0/camera/";

            const extractApple = (tag: string) => {
                const descriptions = xmlDoc.getElementsByTagNameNS("*", "Description");
                for (let i = 0; i < descriptions.length; i++) {
                    const attr = descriptions[i].getAttributeNS(nsApple, tag) || descriptions[i].getAttribute(`apple_photos:${tag}`);
                    if (attr) return attr;
                }
                const elements = xmlDoc.getElementsByTagNameNS(nsApple, tag) || xmlDoc.getElementsByTagName(`apple_photos:${tag}`);
                if (elements.length > 0 && elements[0].textContent) return elements[0].textContent;
                return undefined;
            };

            const assetIdentifier = extractApple('AssetIdentifier');

            if (assetIdentifier) {
                parsedLiveInfo = {
                    isLive: true,
                    assetIdentifier: assetIdentifier
                };
            }
        } catch (e) {
            console.error('Failed to parse XMP XML', e);
        }
    }

    if (parsedLiveInfo.isLive) {
        return {
            isLivePhoto: true,
            assetIdentifier: parsedLiveInfo.assetIdentifier
        };
    }
    return null;
}
