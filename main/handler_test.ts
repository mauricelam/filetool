import { HANDLERS, matchMimetype } from './handlers';

// Local type definition
interface LocalMimeMatchDetailed {
    mime?: string | RegExp;
    filename?: string | RegExp;
    description?: string | RegExp;
}
type LocalMimeMatch = LocalMimeMatchDetailed | string | RegExp;

console.log("Starting handler tests...");

// --- Testing DER PKCS#7 Handler (application/octet-stream with description) ---
console.log("\n--- Testing DER PKCS#7 Handler ---");
const mimeTypeOctet = "application/octet-stream";
const fileNameBin = "testfile.bin";
const descriptionDerPkcs7 = "DER Encoded PKCS#7 Signed Data";
const derPkcs7Handler = HANDLERS.find(h => h.name === "DER Viewer");

if (!derPkcs7Handler) {
    console.error("Test setup error: Could not find 'DER Viewer' handler.");
    process.exit(1);
}
const pkcs7MimeMatchRule = derPkcs7Handler.mimetypes.find(m => {
    const d = m as LocalMimeMatchDetailed;
    return d.mime === mimeTypeOctet && d.description instanceof RegExp && d.description.source === "DER Encoded PKCS#7 Signed Data";
}) as LocalMimeMatch;

if (!pkcs7MimeMatchRule) {
    console.error("Test setup error: Could not find specific MimeMatch rule in 'DER Viewer'.");
    process.exit(1);
}

let r = matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, descriptionDerPkcs7);
console.assert(r, "Test 1.1 Failed (DER PKCS#7 exact match)");
if(r) console.log("Test 1.1 Passed.");
r = matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, "der encoded pkcs#7 signed data");
console.assert(r, "Test 1.2 Failed (DER PKCS#7 case-insensitive)");
if(r) console.log("Test 1.2 Passed.");
r = matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, "Other data");
console.assert(!r, "Test 1.3 Failed (DER PKCS#7 incorrect desc)");
if(!r) console.log("Test 1.3 Passed.");
r = matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, undefined);
console.assert(!r, "Test 1.4 Failed (DER PKCS#7 undefined desc)");
if(!r) console.log("Test 1.4 Passed.");
r = matchMimetype(pkcs7MimeMatchRule, mimeTypeOctet, fileNameBin, null);
console.assert(!r, "Test 1.5 Failed (DER PKCS#7 null desc)");
if(!r) console.log("Test 1.5 Passed.");
r = matchMimetype(pkcs7MimeMatchRule, "text/plain", fileNameBin, descriptionDerPkcs7);
console.assert(!r, "Test 1.6 Failed (DER PKCS#7 incorrect MIME)");
if(!r) console.log("Test 1.6 Passed.");

// --- Testing Generalized Description Matching (text/plain with description) ---
console.log("\n--- Testing Generalized Description Matching ---");
const textPlainWithDescRule: LocalMimeMatchDetailed = { mime: "text/plain", filename: /\.txt$/i, description: /Special Text File Content/i };
const mimeTextPlain = "text/plain";
const fileNameTxt = "document.txt";
const descSpecial = "Special Text File Content";
const descGeneric = "Just some regular text.";

r = matchMimetype(textPlainWithDescRule, mimeTextPlain, fileNameTxt, descSpecial);
console.assert(r, "Test 2.1 Failed (text/plain correct desc/filename)");
if(r) console.log("Test 2.1 Passed.");
r = matchMimetype(textPlainWithDescRule, mimeTextPlain, fileNameTxt, descGeneric);
console.assert(!r, "Test 2.2 Failed (text/plain incorrect desc)");
if(!r) console.log("Test 2.2 Passed.");
r = matchMimetype(textPlainWithDescRule, mimeTextPlain, "doc.log", descSpecial);
console.assert(!r, "Test 2.3 Failed (text/plain wrong filename)");
if(!r) console.log("Test 2.3 Passed.");
r = matchMimetype(textPlainWithDescRule, mimeTextPlain, fileNameTxt, undefined);
console.assert(!r, "Test 2.4 Failed (text/plain undefined desc)");
if(!r) console.log("Test 2.4 Passed.");
r = matchMimetype(textPlainWithDescRule, "application/xml", fileNameTxt, descSpecial); // Corrected mime for this line
console.assert(!r, "Test 2.5 Failed (text/plain incorrect mime)");
if(!r) console.log("Test 2.5 Passed.");

const textPlainDescOnlyRule: LocalMimeMatchDetailed = { mime: "text/plain", description: /Another Special Type/i };
r = matchMimetype(textPlainDescOnlyRule, mimeTextPlain, "any.log", "Another Special Type");
console.assert(r, "Test 2.6 Failed (text/plain desc only, no filename rule)");
if(r) console.log("Test 2.6 Passed.");
r = matchMimetype(textPlainDescOnlyRule, mimeTextPlain, "any.log", "Wrong desc");
console.assert(!r, "Test 2.6b Failed (text/plain desc only, wrong desc)");
if(!r) console.log("Test 2.6b Passed.");

// --- Simplified Test for Handler Rule Without Description ---
console.log("\n--- Simplified Test for Handler Rule Without Description ---");
const ruleWithoutDescription: LocalMimeMatchDetailed = {
    mime: "application/x-custom",
    filename: /\.custom$/
};

// Test 3.1: Matches by mime and filename; description provided to matchMimetype but rule doesn't have one.
r = matchMimetype(ruleWithoutDescription, "application/x-custom", "file.custom", "Some Irrelevant Description");
console.assert(r, "Test 3.1 Failed (Rule w/o desc matched by mime/filename, desc arg ignored)");
if(r) console.log("Test 3.1 Passed.");

// Test 3.2: Matches by mime and filename; NO description provided to matchMimetype.
r = matchMimetype(ruleWithoutDescription, "application/x-custom", "file.custom", undefined);
console.assert(r, "Test 3.2 Failed (Rule w/o desc matched by mime/filename, no desc arg)");
if(r) console.log("Test 3.2 Passed.");

// Test 3.3: Does not match (wrong filename); description provided but rule doesn't care.
r = matchMimetype(ruleWithoutDescription, "application/x-custom", "file.wrongext", "Some Irrelevant Description");
console.assert(!r, "Test 3.3 Failed (Rule w/o desc NOT matched by wrong filename)");
if(!r) console.log("Test 3.3 Passed.");

// Test 3.4: Does not match (wrong mime); description provided but rule doesn't care.
r = matchMimetype(ruleWithoutDescription, "application/other", "file.custom", "Some Irrelevant Description");
console.assert(!r, "Test 3.4 Failed (Rule w/o desc NOT matched by wrong mime)");
if(!r) console.log("Test 3.4 Passed.");

// --- Re-validating specific cases for 'DER' handler's string mime types ---
// These tests still rely on finding rules in the actual HANDLERS array for 'DER'
console.log("\n--- Re-validating 'DER' handler's string mime types ---");
const derHandlerByName = HANDLERS.find(h => h.name === "DER");
if (!derHandlerByName) {
    console.error("Test setup error: Could not find 'DER' handler by name for string mime tests.");
    // Not exiting, to allow other tests to run, but this is a problem.
} else {
    const pkixCertRule = derHandlerByName.mimetypes.find(m => typeof m === 'string' && m === "application/pkix-cert") as LocalMimeMatch;
    const pemFileRule = derHandlerByName.mimetypes.find(m => typeof m === 'string' && m === "application/x-pem-file") as LocalMimeMatch;

    if(pkixCertRule) {
        r = matchMimetype(pkixCertRule, "application/pkix-cert", "test.crt", "irrelevant desc");
        console.assert(r, `Test Cert Mime Failed (app/pkix-cert)`);
        if (r) console.log("Test Cert Mime Passed.");
    } else {
        console.log("Skipping Test Cert Mime: 'application/pkix-cert' string rule not found in 'DER' handler.");
    }

    if(pemFileRule) {
        r = matchMimetype(pemFileRule, "application/x-pem-file", "my.pem", undefined);
        console.assert(r, `Test PEM Mime Failed (app/x-pem-file)`);
        if (r) console.log("Test PEM Mime Passed.");
    } else {
        console.log("Skipping Test PEM Mime: 'application/x-pem-file' string rule not found in 'DER' handler.");
    }
}

console.log("\nHandler tests finished. Review console assertions.");
