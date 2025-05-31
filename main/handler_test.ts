import { HANDLERS, matchMimetype } from './handlers';

// Local type definition for clarity if MimeMatch/MimeMatchDetailed are not exported
interface LocalMimeMatchDetailed {
    mime?: string | RegExp;
    filename?: string | RegExp;
    description?: string | RegExp;
}
type LocalMimeMatch = LocalMimeMatchDetailed | string | RegExp;


console.log("Starting handler test for DER PKCS#7 specific matching...");

// Test case 1: Correct DER PKCS#7 description
const mimeType1 = "application/octet-stream";
const fileName1 = "testfile.bin";
const description1 = "DER Encoded PKCS#7 Signed Data";

const derPkcs7Handler = HANDLERS.find(h =>
    h.name === "DER Viewer" &&
    h.mimetypes.some(m => {
        const detailed = m as LocalMimeMatchDetailed;
        return detailed.mime === "application/octet-stream" &&
               detailed.description instanceof RegExp &&
               detailed.description.source === "DER Encoded PKCS#7 Signed Data";
    })
);

if (!derPkcs7Handler) {
    console.error("Test setup error: Could not find the specific DER PKCS#7 handler in HANDLERS array. Check handler name and regex source string.");
    process.exit(1);
}

const pkcs7MimeMatch = derPkcs7Handler.mimetypes.find(m => {
    const detailed = m as LocalMimeMatchDetailed;
    return detailed.mime === "application/octet-stream" &&
           detailed.description instanceof RegExp &&
           detailed.description.source === "DER Encoded PKCS#7 Signed Data";
}) as LocalMimeMatch;

if (!pkcs7MimeMatch) {
    console.error("Test setup error: Could not find the MimeMatch with description 'DER Encoded PKCS#7 Signed Data' in DER Viewer handler.");
    process.exit(1);
}

const result1 = matchMimetype(pkcs7MimeMatch, mimeType1, fileName1, description1);
console.assert(result1, `Test Case 1 Failed: Expected true for '${description1}', got ${result1}. Handler: ${derPkcs7Handler.name}`);
if (result1) console.log("Test Case 1 Passed: Correctly matched DER PKCS#7 by description.");

// Test case 1b: Correct DER PKCS#7 description with different casing (should still match due to /i flag)
const description1b = "der encoded pkcs#7 signed data";
const result1b = matchMimetype(pkcs7MimeMatch, mimeType1, fileName1, description1b);
console.assert(result1b, `Test Case 1b Failed: Expected true for '${description1b}' (case-insensitive), got ${result1b}.`);
if (result1b) console.log("Test Case 1b Passed: Correctly matched DER PKCS#7 by description (case-insensitive).");

// Test case 2: Incorrect description
const description2 = "Some other binary data";
const result2 = matchMimetype(pkcs7MimeMatch, mimeType1, fileName1, description2);
console.assert(!result2, `Test Case 2 Failed: Expected false for incorrect description '${description2}', got ${result2}.`);
if (!result2) console.log("Test Case 2 Passed: Correctly did not match with incorrect description.");

// Test case 3: Description is undefined (as if not provided to matchMimetype)
const result3 = matchMimetype(pkcs7MimeMatch, mimeType1, fileName1, undefined);
console.assert(!result3, `Test Case 3 Failed: Expected false for undefined description, got ${result3}.`);
if (!result3) console.log("Test Case 3 Passed: Correctly did not match with undefined description.");

// Test case 3b: Description is null
const result3b = matchMimetype(pkcs7MimeMatch, mimeType1, fileName1, null);
console.assert(!result3b, `Test Case 3b Failed: Expected false for null description, got ${result3b}.`);
if (!result3b) console.log("Test Case 3b Passed: Correctly did not match with null description.");

// Test case 4: Non application/octet-stream MIME type (should not trigger description logic for this specific handler rule)
const mimeType4 = "text/plain";
const result4 = matchMimetype(pkcs7MimeMatch, mimeType4, fileName1, description1);
console.assert(!result4, `Test Case 4 Failed: Expected false for non-octet-stream MIME '${mimeType4}', got ${result4}.`);
if (!result4) console.log("Test Case 4 Passed: Correctly did not match with non-octet-stream for description rule.");

// Test case 5: Check existing DER handler for .der extension (should still work)
const derHandlerByExt = HANDLERS.find(h =>
    h.name === "DER" && // This is the other DER handler
    h.mimetypes.some(m => {
        const detailed = m as LocalMimeMatchDetailed;
        return detailed.filename instanceof RegExp &&
               detailed.filename.source === "\\.(der|crt|cer|pem|rsa)$"; // Exact regex source match (double escaped for string)
    })
);

if (!derHandlerByExt) {
    console.error("Test setup error: Could not find the general DER extension handler. Check name and filename regex source: '\\.(der|crt|cer|pem|rsa)$'.");
    process.exit(1);
}
const derExtensionMimeMatch = derHandlerByExt.mimetypes.find(m => {
    const detailed = m as LocalMimeMatchDetailed;
    return detailed.filename instanceof RegExp &&
           detailed.filename.source === "\\.(der|crt|cer|pem|rsa)$";
}) as LocalMimeMatch;


if (!derExtensionMimeMatch) {
    console.error("Test setup error: Could not find MimeMatch with filename regex '\\.(der|crt|cer|pem|rsa)$' in general DER handler.");
    process.exit(1);
}

const result5 = matchMimetype(derExtensionMimeMatch, "application/octet-stream", "test.der", "Some random description");
console.assert(result5, `Test Case 5 Failed: Expected true for .der extension, got ${result5}`);
if (result5) console.log("Test Case 5 Passed: Correctly matched .der file by extension.");

const result5b = matchMimetype(derExtensionMimeMatch, "application/x-x509-ca-cert", "test.crt", undefined);
console.assert(result5b, `Test Case 5b Failed: Expected true for .crt & x509 mime (no description needed), got ${result5b}`);
if (result5b) console.log("Test Case 5b Passed: Correctly matched .crt file by ext/mime.");

console.log("Handler test finished. Review console assertions.");
