import { HANDLERS, matchMimetype, sortHandlersBySpecificity, HandlerDefinition } from './index';

describe('Swift File Handler', () => {
    it('should match .swift files by extension', () => {
        const swiftFileMime = 'application/octet-stream';
        const swiftFileName = 'example.swift';

        const textViewerHandler = HANDLERS.find(h => h.name === 'Text Viewer');
        expect(textViewerHandler).toBeDefined();

        const isMatch = textViewerHandler!.mimetypes.some(m => matchMimetype(m, swiftFileMime, swiftFileName));
        expect(isMatch).toBe(true);
    });

    it('should have textviewer and hexviewer as potential handlers for .swift files', () => {
        const swiftFileMime = 'application/octet-stream';
        const swiftFileName = 'example.swift';

        const matchingHandlers = HANDLERS.filter(h =>
            h.mimetypes.some(m => matchMimetype(m, swiftFileMime, swiftFileName))
        );

        const hasTextViewer = matchingHandlers.some(h => h.handler === 'textviewer');
        const hasHexViewer = matchingHandlers.some(h => h.handler === 'hex_viewer');

        expect(hasTextViewer).toBe(true);
        expect(hasHexViewer).toBe(true);
    });

    it('should prioritize textviewer over hexviewer for .swift files', () => {
        const swiftFileMime = 'application/octet-stream';
        const swiftFileName = 'example.swift';

        const matchingHandlers = HANDLERS.filter(h =>
            h.mimetypes.some(m => matchMimetype(m, swiftFileMime, swiftFileName))
        );

        const sortedHandlers = sortHandlersBySpecificity(matchingHandlers, swiftFileMime, swiftFileName);

        const textViewerIndex = sortedHandlers.findIndex(h => h.handler === 'textviewer');
        const hexViewerIndex = sortedHandlers.findIndex(h => h.handler === 'hex_viewer');

        expect(textViewerIndex).not.toBe(-1);
        expect(hexViewerIndex).not.toBe(-1);
        expect(textViewerIndex).toBeLessThan(hexViewerIndex);
        expect(sortedHandlers[0].handler).toBe('textviewer');
    });
});
