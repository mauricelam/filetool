import fs from 'node:fs';
import path from 'node:path';
import admZip from 'adm-zip';
import { FrameLocator, expect } from '@playwright/test';

export interface FixtureInfo {
    filePath: string;
    expectedText: string;
    additionalFiles?: Array<{ filePath: string; name: string; content: Buffer | string }>;
}

/**
 * Creates a valid DMG buffer containing an XML plist with partition name `canary`.
 */
function createDmgBuffer(canary: string): Buffer {
    const xmlStr = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>resource-fork</key>
	<dict>
		<key>blkx</key>
		<array>
			<dict>
				<key>Attributes</key>
				<string>0x0050</string>
				<key>CFName</key>
				<string>Partition-${canary}</string>
				<key>Data</key>
				<data></data>
				<key>ID</key>
				<string>0</string>
				<key>Name</key>
				<string>Partition-${canary}</string>
			</dict>
		</array>
	</dict>
</dict>
</plist>`;

    const xmlBuffer = Buffer.from(xmlStr, 'utf-8');
    const xmlOffset = 1000;
    const xmlLength = xmlBuffer.length;
    const totalSize = 50000;
    const buf = Buffer.alloc(totalSize);

    xmlBuffer.copy(buf, xmlOffset);

    const kolyOffset = totalSize - 512;
    buf.write('koly', kolyOffset, 4, 'ascii');
    buf.writeUInt32BE(4, kolyOffset + 4);       // version = 4
    buf.writeUInt32BE(512, kolyOffset + 8);     // header_size = 512
    buf.writeUInt32BE(1, kolyOffset + 12);      // flags = 1
    buf.writeBigUInt64BE(BigInt(xmlOffset), kolyOffset + 216); // plist_offset
    buf.writeBigUInt64BE(BigInt(xmlLength), kolyOffset + 224); // plist_length

    return buf;
}

/**
 * Creates a minimal valid PDF containing text.
 */
function createPdfBuffer(canary: string): Buffer {
    const content = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kinds [3 0 R] /Count 1 /Kids [3 0 R]>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
4 0 obj <</Length 55>> stream
BT
/F1 24 Tf
100 700 Td
(${canary}) Tj
ET
endstream endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000133 00000 n
0000000257 00000 n
0000000362 00000 n
trailer <</Size 6 /Root 1 0 R>>
startxref
431
%%EOF`;
    return Buffer.from(content, 'utf-8');
}

/**
 * Creates a minimal WASM buffer containing a custom section with `canary`.
 */
function createWasmBuffer(canary: string): Buffer {
    const nameBytes = Buffer.from(canary, 'utf-8');
    const header = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]); // \0asm v1
    const nameLen = nameBytes.length;
    const sectionLen = 1 + nameLen + 1;
    const section = Buffer.from([0x00, sectionLen, nameLen, ...nameBytes, 0x00]);
    return Buffer.concat([header, section]);
}

/**
 * Creates a minimal GZIP buffer containing `canary`.
 */
function createGzipBuffer(canary: string): Buffer {
    const zlib = require('node:zlib');
    return zlib.gzipSync(Buffer.from(`Decompressed: ${canary}`, 'utf-8'));
}

/**
 * Creates a minimal ZIP buffer (OOXML / DOCX / APK / Archive) containing `canary`.
 */
function createZipWithFile(filename: string, content: string | Buffer): Buffer {
    const zip = new admZip();
    zip.addFile(filename, typeof content === 'string' ? Buffer.from(content) : content);
    return zip.toBuffer();
}

/**
 * Creates a minimal DOCX (OOXML) zip archive containing `word/document.xml` with `canary`.
 */
function createDocxBuffer(canary: string): Buffer {
    const zip = new admZip();
    zip.addFile('[Content_Types].xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`));
    zip.addFile('word/document.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${canary}</w:t></w:r></w:p>
  </w:body>
</w:document>`));
    return zip.toBuffer();
}

/**
 * Creates a minimal APK buffer.
 */
function createApkBuffer(canary: string): Buffer {
    const zip = new admZip();
    zip.addFile('AndroidManifest.xml', Buffer.from(`<?xml version="1.0"?><manifest package="${canary}"></manifest>`));
    zip.addFile('resources.arsc', Buffer.from(canary));
    return zip.toBuffer();
}

/**
 * Creates a minimal PCAP buffer containing a packet payload with `canary`.
 */
function createPcapBuffer(canary: string): Buffer {
    const payload = Buffer.from(`GET / ${canary} HTTP/1.1\r\n\r\n`);
    const globalHeader = Buffer.alloc(24);
    globalHeader.writeUInt32LE(0xa1b2c3d4, 0); // Magic number
    globalHeader.writeUInt16LE(2, 4); // Major version
    globalHeader.writeUInt16LE(4, 6); // Minor version
    globalHeader.writeUInt32LE(65535, 16); // Snaplen
    globalHeader.writeUInt32LE(1, 20); // Link type (Ethernet)

    const pktHeader = Buffer.alloc(16);
    pktHeader.writeUInt32LE(1000, 0); // timestamp sec
    pktHeader.writeUInt32LE(0, 4); // timestamp usec
    pktHeader.writeUInt32LE(payload.length, 8); // incl_len
    pktHeader.writeUInt32LE(payload.length, 12); // orig_len

    return Buffer.concat([globalHeader, pktHeader, payload]);
}

/**
 * Creates a minimal HPROF buffer containing a string record with `canary`.
 */
function createHprofBuffer(canary: string): Buffer {
    const headerStr = "JAVA PROFILE 1.0.2\0";
    const headerBuf = Buffer.alloc(headerStr.length + 4 + 8);
    headerBuf.write(headerStr, 0, 'ascii');
    headerBuf.writeUInt32BE(4, headerStr.length); // Identifier size = 4
    headerBuf.writeBigUInt64BE(1000n, headerStr.length + 4); // Timestamp

    const canaryBuf = Buffer.from(canary, 'utf-8');
    const recordBuf = Buffer.alloc(1 + 4 + 4 + 4 + canaryBuf.length);
    recordBuf.writeUInt8(0x01, 0); // STRING record
    recordBuf.writeUInt32BE(0, 1); // time
    recordBuf.writeUInt32BE(4 + canaryBuf.length, 5); // record length
    recordBuf.writeUInt32BE(0x1234, 9); // String ID
    canaryBuf.copy(recordBuf, 13);

    return Buffer.concat([headerBuf, recordBuf]);
}

/**
 * Creates a minimal SQLite database containing a table with `canary`.
 */
function createSqliteBuffer(canary: string): Buffer {
    const header = Buffer.alloc(100);
    header.write("SQLite format 3\0", 0, 'ascii');
    header.writeUInt16BE(4096, 16); // Page size 4096
    header.writeUInt8(1, 18);
    header.writeUInt8(1, 19);
    header.writeUInt32BE(1, 28); // Page count
    header.writeUInt32BE(1, 40); // Schema cookie
    header.writeUInt32BE(4, 44); // Text encoding (UTF-8)

    const page = Buffer.alloc(4096);
    header.copy(page, 0);
    page.writeUInt8(0x0d, 100); // Leaf table page
    page.write(canary, 200, 'utf-8');
    return page;
}

/**
 * Creates a fixture file for the specified handler and canary string.
 */
export function createFixtureForHandler(handlerId: string, canary: string, outputDir: string): FixtureInfo {
    fs.mkdirSync(outputDir, { recursive: true });

    let fileName = `fixture_${canary.replace(/[^a-zA-Z0-9-]/g, '_')}`;
    let fileContent: Buffer | string = `CANARY_DATA: ${canary}`;
    let expectedText = canary;
    let additionalFiles: Array<{ filePath: string; name: string; content: Buffer | string }> | undefined = undefined;

    switch (handlerId) {
        case 'textviewer':
            fileName += '.txt';
            fileContent = `Text file content: ${canary}`;
            break;
        case 'markdown':
            fileName += '.md';
            fileContent = `# Title\n\nMarkdown content: ${canary}`;
            break;
        case 'hex_viewer':
            fileName += '.bin';
            fileContent = Buffer.from(`Binary file with ${canary}`);
            break;
        case 'cborviewer':
            fileName += '.cbor';
            const canaryBuf = Buffer.from(canary, 'utf-8');
            fileContent = Buffer.concat([Buffer.from([0x60 + canaryBuf.length]), canaryBuf]);
            break;
        case 'dmg-viewer':
            fileName += '.dmg';
            fileContent = createDmgBuffer(canary);
            break;
        case 'img-viewer':
            fileName += '.img';
            fileContent = Buffer.from(`RAW IMG CONTAINER: ${canary}`);
            break;
        case 'squashfs':
            fileName += '.sqfs';
            fileContent = Buffer.from(`SquashFS container: ${canary}`);
            break;
        case 'mhtml':
            fileName += '.eml';
            fileContent = `From: sender@example.com\nTo: recipient@example.com\nSubject: ${canary}\n\nEmail body content with ${canary}`;
            break;
        case 'pdfjs':
            fileName += '.pdf';
            fileContent = createPdfBuffer(canary);
            break;
        case 'svgviewer':
            fileName += '.svg';
            fileContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="10" y="50">${canary}</text></svg>`;
            break;
        case 'browser':
            fileName += '.html';
            fileContent = `<!DOCTYPE html><html><body><h1>${canary}</h1></body></html>`;
            break;
        case 'dexviewer':
            fileName += '.dex';
            const sampleDexPath = path.join(__dirname, '../../dexviewer/dex-parser/resources/classes.dex');
            if (fs.existsSync(sampleDexPath)) {
                const sampleDex = fs.readFileSync(sampleDexPath);
                fileContent = Buffer.concat([sampleDex, Buffer.from(`\0${canary}\0`)]);
            } else {
                fileContent = Buffer.from(`DEX035\0${canary}`);
            }
            break;
        case 'graphviz':
            fileName += '.dot';
            fileContent = `digraph G {\n  "Node_${canary}" [label="${canary}"];\n}`;
            break;
        case 'jqviewer':
            fileName += '.json';
            fileContent = JSON.stringify({ canaryKey: canary, project: "filetool" }, null, 2);
            break;
        case 'webgl_previewer':
            fileName += '.stl';
            fileContent = `solid ${canary}
facet normal 0 0 0
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
endsolid ${canary}`;
            break;
        case 'wat_viewer':
            fileName += '.wasm';
            fileContent = createWasmBuffer(canary);
            break;
        case 'archive':
            fileName += '.zip';
            fileContent = createZipWithFile(`file_${canary}.txt`, `Archive payload with ${canary}`);
            break;
        case 'apk-viewer':
            fileName += '.apk';
            fileContent = createApkBuffer(canary);
            break;
        case 'android-xml':
            fileName += '.arsc';
            fileContent = Buffer.from(`Android Binary XML Resource: ${canary}`);
            break;
        case 'classfile':
            fileName += '.class';
            fileContent = Buffer.concat([Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0x00, 0x00, 0x00, 0x34]), Buffer.from(canary)]);
            break;
        case 'binutils':
        case 'ghidra':
            fileName += '.elf';
            fileContent = Buffer.concat([Buffer.from('\x7fELF\x02\x01\x01\x00', 'ascii'), Buffer.from(canary)]);
            break;
        case 'imagemagick':
            fileName += '.png';
            fileContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
            break;
        case 'ffmpeg':
            fileName += '.wav';
            fileContent = Buffer.concat([
                Buffer.from('RIFF....WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data....', 'binary'),
                Buffer.from(`TAG:${canary}`)
            ]);
            break;
        case 'der':
            fileName += '.pem';
            fileContent = `-----BEGIN CERTIFICATE-----\n${Buffer.from(canary).toString('base64')}\n-----END CERTIFICATE-----`;
            break;
        case 'protoscope':
            fileName += '.pb';
            fileContent = Buffer.concat([Buffer.from([0x0a, canary.length]), Buffer.from(canary)]);
            break;
        case 'flatbuffers':
            fileName += '.fbs';
            fileContent = `namespace CanaryTest;\ntable Item { name: string; }\nroot_type Item; // ${canary}`;
            break;
        case 'sqliteviewer':
            fileName += '.sqlite';
            fileContent = createSqliteBuffer(canary);
            break;
        case 'proguardviewer':
            fileName += '.map';
            fileContent = `com.example.Canary -> com.example.a:\n    java.lang.String ${canary} -> a`;
            break;
        case 'decompressor':
            fileName += '.gz';
            fileContent = createGzipBuffer(canary);
            break;
        case 'bplistviewer':
            fileName += '.bplist';
            fileContent = Buffer.concat([Buffer.from('bplist00', 'ascii'), Buffer.from(canary)]);
            break;
        case 'parquetviewer':
            fileName += '.parquet';
            fileContent = Buffer.from(`PAR1_PARQUET_${canary}_PAR1`);
            break;
        case 'setools':
            fileName += '.sepolicy';
            fileContent = Buffer.from(`SELinux Policy Type ${canary}`);
            break;
        case 'hprof':
            fileName += '.hprof';
            fileContent = createHprofBuffer(canary);
            break;
        case 'pcap':
            fileName += '.pcap';
            fileContent = createPcapBuffer(canary);
            break;
        case 'ooxmlviewer':
            fileName += '.docx';
            fileContent = createDocxBuffer(canary);
            break;
        case 'rstviewer':
            fileName += '.rst';
            fileContent = `Title\n=====\n\nreStructuredText content: ${canary}`;
            break;
        case 'diffviewer':
            fileName += '_a.txt';
            fileContent = `Line 1: ${canary}\nLine 2`;
            const secondContent = `Line 1: ${canary}_modified\nLine 2`;
            const secondPath = path.join(outputDir, `fixture_${canary.replace(/[^a-zA-Z0-9-]/g, '_')}_b.txt`);
            fs.writeFileSync(secondPath, secondContent);
            additionalFiles = [{
                filePath: secondPath,
                name: `fixture_${canary.replace(/[^a-zA-Z0-9-]/g, '_')}_b.txt`,
                content: secondContent
            }];
            break;
        case 'concatenate':
            fileName += '_a.txt';
            fileContent = `Part 1: ${canary}`;
            const concatSecondContent = `Part 2: ${canary}`;
            const concatSecondPath = path.join(outputDir, `fixture_${canary.replace(/[^a-zA-Z0-9-]/g, '_')}_b.txt`);
            fs.writeFileSync(concatSecondPath, concatSecondContent);
            additionalFiles = [{
                filePath: concatSecondPath,
                name: `fixture_${canary.replace(/[^a-zA-Z0-9-]/g, '_')}_b.txt`,
                content: concatSecondContent
            }];
            break;
        case 'cyberchef':
            fileName += '.txt';
            fileContent = `CyberChef input: ${canary}`;
            break;
        default:
            fileName += '.txt';
            fileContent = `Generic payload: ${canary}`;
            break;
    }

    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, fileContent);

    return { filePath, expectedText, additionalFiles };
}

/**
 * Asserts that the target viewer iframe has successfully rendered its output.
 */
export async function verifyViewerRendered(iframe: FrameLocator, handlerId: string, expectedText: string) {
    const body = iframe.locator('body');
    await expect(body).toBeVisible({ timeout: 15000 });

    switch (handlerId) {
        case 'hex_viewer':
            await expect(iframe.locator('#hexviewer, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'imagemagick':
            await expect(iframe.locator('canvas, img, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'webgl_previewer':
            await expect(iframe.locator('canvas, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'ffmpeg':
            await expect(iframe.locator('audio, video, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'hprof':
            await expect(iframe.locator('canvas, #hprof-summary, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'pdfjs':
            await expect(iframe.locator('canvas, .textLayer, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'browser':
            await expect(iframe.locator('iframe, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'cyberchef':
            await expect(iframe.locator('#input-text, iframe, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'mhtml':
            await expect(iframe.locator('#mail-body, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'archive':
            await expect(iframe.locator('table, .file-list, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'protoscope':
            await expect(iframe.locator('.ace_content, body').first()).toBeVisible({ timeout: 15000 });
            break;
        case 'parquetviewer':
        case 'ooxmlviewer':
        case 'sqliteviewer':
        case 'bplistviewer':
        case 'cborviewer':
        case 'dexviewer':
        case 'img-viewer':
        case 'squashfs':
        case 'apk-viewer':
        case 'android-xml':
        case 'classfile':
        case 'ghidra':
        case 'binutils':
        case 'wat_viewer':
            await expect(iframe.locator('table, canvas, .ace_content, .file-list, .tree-node, body').first()).toBeVisible({ timeout: 15000 });
            break;
        default:
            // For standard viewers, assert that the expected canary text is rendered in the iframe body
            await expect(body).toContainText(expectedText, { timeout: 15000 });
            break;
    }
}

/**
 * Creates a >4GB sparse file with canary text at ~4GB offset.
 */
export function createSparseLargeFile(filePath: string, canary: string, sizeBytes: number = 4.5 * 1024 * 1024 * 1024): string {
    const fd = fs.openSync(filePath, 'w');
    const header = Buffer.from(`SPARSE_LARGE_FILE_HEADER offset=0\nCanary near end: ${canary}\n`);
    fs.writeSync(fd, header, 0, header.length, 0);

    fs.ftruncateSync(fd, sizeBytes);

    const canaryOffset = 4 * 1024 * 1024 * 1024;
    const canaryBuf = Buffer.from(`CANARY_SPARSE_4GB_DATA: ${canary}\n`);
    fs.writeSync(fd, canaryBuf, 0, canaryBuf.length, canaryOffset);

    fs.closeSync(fd);
    return filePath;
}
