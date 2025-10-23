import { HANDLERS, matchMimetype } from './handlers';

// Local type definition
interface LocalMimeMatchDetailed {
    mime?: string | RegExp;
    filename?: string | RegExp;
    description?: string | RegExp;
}
type LocalMimeMatch = LocalMimeMatchDetailed | string | RegExp;

describe('Handler Tests', () => {
    describe('DER PKCS#7 Handler', () => {
        const mimeTypeOctet = "application/octet-stream";
        const fileNameBin = "testfile.bin";
        const descriptionDerPkcs7 = "DER Encoded PKCS#7 Signed Data";
        const derPkcs7Handler = HANDLERS.find(h => h.name === "DER");

        beforeAll(() => {
            if (!derPkcs7Handler) {
                throw new Error("Test setup error: Could not find 'DER' handler.");
            }
        });

        const pkcs7MimeMatchRule = derPkcs7Handler?.mimetypes.find(m => {
            const d = m as LocalMimeMatchDetailed;
            return d.mime === mimeTypeOctet && d.description instanceof RegExp && d.description.source === "DER Encoded PKCS#7 Signed Data";
        }) as LocalMimeMatch;

        beforeAll(() => {
            if (!pkcs7MimeMatchRule) {
                throw new Error("Test setup error: Could not find specific MimeMatch rule in 'DER'.");
            }
        });

        test('should match exact DER PKCS#7 description', () => {
            expect(matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, descriptionDerPkcs7)).toBe(true);
        });

        test('should match case-insensitive DER PKCS#7 description', () => {
            expect(matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, "der encoded pkcs#7 signed data")).toBe(true);
        });

        test('should not match incorrect description', () => {
            expect(matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, "Other data")).toBe(false);
        });

        test('should not match undefined description', () => {
            expect(matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, undefined)).toBe(false);
        });

        test('should not match null description', () => {
            expect(matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, null)).toBe(false);
        });

        test('should not match incorrect MIME type', () => {
            expect(matchMimetype(pkcs7MimeMatchRule, "text/plain", fileNameBin, descriptionDerPkcs7)).toBe(false);
        });
    });

    describe('Generalized Description Matching', () => {
        const textPlainWithDescRule: LocalMimeMatchDetailed = { 
            mime: "text/plain", 
            filename: /\.txt$/i, 
            description: /Special Text File Content/i 
        };
        const mimeTextPlain = "text/plain";
        const fileNameTxt = "document.txt";
        const descSpecial = "Special Text File Content";
        const descGeneric = "Just some regular text.";

        test('should match correct description and filename', () => {
            expect(matchMimetype(textPlainWithDescRule, mimeTextPlain, fileNameTxt, descSpecial)).toBe(true);
        });

        test('should not match incorrect description', () => {
            expect(matchMimetype(textPlainWithDescRule, mimeTextPlain, fileNameTxt, descGeneric)).toBe(false);
        });

        test('should not match wrong filename', () => {
            expect(matchMimetype(textPlainWithDescRule, mimeTextPlain, "doc.log", descSpecial)).toBe(false);
        });

        test('should not match undefined description', () => {
            expect(matchMimetype(textPlainWithDescRule, mimeTextPlain, fileNameTxt, undefined)).toBe(false);
        });

        test('should not match incorrect mime type', () => {
            expect(matchMimetype(textPlainWithDescRule, "application/xml", fileNameTxt, descSpecial)).toBe(false);
        });

        const textPlainDescOnlyRule: LocalMimeMatchDetailed = { 
            mime: "text/plain", 
            description: /Another Special Type/i 
        };

        test('should match description only rule without filename', () => {
            expect(matchMimetype(textPlainDescOnlyRule, mimeTextPlain, "any.log", "Another Special Type")).toBe(true);
        });

        test('should not match wrong description with description only rule', () => {
            expect(matchMimetype(textPlainDescOnlyRule, mimeTextPlain, "any.log", "Wrong desc")).toBe(false);
        });
    });

    describe('Handler Rule Without Description', () => {
        const ruleWithoutDescription: LocalMimeMatchDetailed = {
            mime: "application/x-custom",
            filename: /\.custom$/
        };

        test('should match by mime and filename when description provided but not required', () => {
            expect(matchMimetype(ruleWithoutDescription, "application/x-custom", "file.custom", "Some Irrelevant Description")).toBe(true);
        });

        test('should match by mime and filename when no description provided', () => {
            expect(matchMimetype(ruleWithoutDescription, "application/x-custom", "file.custom", undefined)).toBe(true);
        });

        test('should not match wrong filename', () => {
            expect(matchMimetype(ruleWithoutDescription, "application/x-custom", "file.wrongext", "Some Irrelevant Description")).toBe(false);
        });

        test('should not match wrong mime type', () => {
            expect(matchMimetype(ruleWithoutDescription, "application/other", "file.custom", "Some Irrelevant Description")).toBe(false);
        });
    });

    describe('DER handler string mime types', () => {
        const derHandlerByName = HANDLERS.find(h => h.name === "DER");
        
        if (derHandlerByName) {
            const pkixCertRule = derHandlerByName.mimetypes.find(m => typeof m === 'string' && m === "application/pkix-cert") as LocalMimeMatch;
            const pemFileRule = derHandlerByName.mimetypes.find(m => typeof m === 'string' && m === "application/x-pem-file") as LocalMimeMatch;

            if (pkixCertRule) {
                test('should match PKIX certificate mime type', () => {
                    expect(matchMimetype(pkixCertRule, "application/pkix-cert", "test.crt", "irrelevant desc")).toBe(true);
                });
            }

            if (pemFileRule) {
                test('should match PEM file mime type', () => {
                    expect(matchMimetype(pemFileRule, "application/x-pem-file", "my.pem", undefined)).toBe(true);
                });
            }
        }
    });

    describe('reStructuredText Handler', () => {
      it('correctly matches .rst files by extension', () => {
        const matchedHandlers = HANDLERS.filter(h =>
          h.mimetypes.some(m => matchMimetype(m, 'application/octet-stream', 'mydocument.rst'))
        );
        // Check that rstviewer is among the matched handlers
        expect(matchedHandlers.some(h => h.handler === 'rstviewer')).toBe(true);
        // Optionally, check that it's the specific named handler if you want to be more precise
        expect(matchedHandlers.some(h => h.handler === 'rstviewer' && h.name === 'reStructuredText Viewer')).toBe(true);
      });

      it('correctly matches .rst files by text/x-rst mimetype', () => {
        const matchedHandlers = HANDLERS.filter(h =>
          h.mimetypes.some(m => matchMimetype(m, 'text/x-rst', 'mydocument.rst'))
        );
        expect(matchedHandlers.some(h => h.handler === 'rstviewer')).toBe(true);
        expect(matchedHandlers.some(h => h.handler === 'rstviewer' && h.name === 'reStructuredText Viewer')).toBe(true);
      });

      it('gives rstviewer precedence over textviewer for .rst files', () => {
        const filename = 'test.rst';
        const mime = 'text/x-rst'; // or application/octet-stream if matching primarily by filename

        // Find all handlers that could match
        const matchedHandlers = HANDLERS.filter(h =>
            h.mimetypes.some(m => matchMimetype(m, mime, filename))
        );

        // Find the index of rstviewer and textviewer
        const rstViewerIndex = matchedHandlers.findIndex(h => h.handler === 'rstviewer');
        const textViewerIndex = matchedHandlers.findIndex(h => h.handler === 'textviewer');

        // Expect rstviewer to be found
        expect(rstViewerIndex).not.toBe(-1);

        // If textviewer is also found, rstviewer should come first
        if (textViewerIndex !== -1) {
            expect(rstViewerIndex).toBeLessThan(textViewerIndex);
        }
      });
    });
});
