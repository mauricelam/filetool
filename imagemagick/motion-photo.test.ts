import { describe, it, expect, vi } from 'vitest';
import { extractMotionPhotoInfo } from './motion-photo';
import { IMagickImage } from '@imagemagick/magick-wasm';

describe('extractMotionPhotoInfo', () => {
    const createMockImage = (xmpString?: string) => {
        return {
            getProfile: vi.fn((name: string) => {
                if (name === 'xmp' && xmpString) {
                    return {
                        data: new TextEncoder().encode(xmpString)
                    };
                }
                return null;
            })
        } as unknown as IMagickImage;
    };

    it('should return null if no motion photo metadata is present', () => {
        const image = createMockImage();
        expect(extractMotionPhotoInfo(image)).toBeNull();
    });

    it('should detect motion photo from XMP XML attributes', () => {
        const xml = `
            <x:xmpmeta xmlns:x="adobe:ns:meta/">
                <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
                    <rdf:Description 
                        xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" 
                        GCamera:MotionPhoto="1" 
                        GCamera:MicroVideoOffset="12345" />
                </rdf:RDF>
            </x:xmpmeta>
        `;
        const image = createMockImage(xml);
        const result = extractMotionPhotoInfo(image);
        expect(result).not.toBeNull();
        expect(result?.isMotionPhoto).toBe(true);
        expect(result?.microVideoOffset).toBe('12345');
    });

    it('should detect motion photo from XMP XML elements', () => {
        const xml = `
            <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/">
                <rdf:Description>
                    <GCamera:MotionPhoto>1</GCamera:MotionPhoto>
                    <GCamera:MicroVideoOffset>54321</GCamera:MicroVideoOffset>
                    <GCamera:MotionPhotoPresentationTimestampUs>999</GCamera:MotionPhotoPresentationTimestampUs>
                </rdf:Description>
            </rdf:RDF>
        `;
        const image = createMockImage(xml);
        const result = extractMotionPhotoInfo(image);
        expect(result).not.toBeNull();
        expect(result?.isMotionPhoto).toBe(true);
        expect(result?.microVideoOffset).toBe('54321');
        expect(result?.presentationTimestampUs).toBe('999');
    });

    it('should extract motion photo info when present in XMP', () => {
        const xml = `
            <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/">
                <rdf:Description>
                    <GCamera:MicroVideoOffset>100</GCamera:MicroVideoOffset>
                    <GCamera:MotionPhoto>1</GCamera:MotionPhoto>
                </rdf:Description>
            </rdf:RDF>
        `;
        const image = createMockImage(xml);
        const result = extractMotionPhotoInfo(image);
        expect(result?.isMotionPhoto).toBe(true);
        expect(result?.microVideoOffset).toBe('100');
    });

    it('should detect motion photo from new Container:Directory format', () => {
        const xml = `
            <x:xmpmeta xmlns:x="adobe:ns:meta/">
                <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
                    <rdf:Description 
                        xmlns:Container="http://ns.google.com/photos/1.0/container/"
                        xmlns:Item="http://ns.google.com/photos/1.0/container/item/"
                        xmlns:GCamera="http://ns.google.com/photos/1.0/camera/"
                        GCamera:MotionPhoto="1">
                        <Container:Directory>
                            <rdf:Seq>
                                <rdf:li rdf:parseType="Resource">
                                    <Container:Item Item:Semantic="Primary" Item:Mime="image/jpeg" />
                                </rdf:li>
                                <rdf:li rdf:parseType="Resource">
                                    <Container:Item Item:Length="1107297" Item:Mime="video/mp4" Item:Semantic="MotionPhoto" />
                                </rdf:li>
                            </rdf:Seq>
                        </Container:Directory>
                    </rdf:Description>
                </rdf:RDF>
            </x:xmpmeta>
        `;
        const image = createMockImage(xml);
        const result = extractMotionPhotoInfo(image);
        expect(result).not.toBeNull();
        expect(result?.isMotionPhoto).toBe(true);
        expect(result?.microVideoOffset).toBe('1107297');
    });
});
