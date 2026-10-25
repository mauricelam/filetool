import { test, expect } from '../../tests/fixtures.js';
import { runHandlerTest } from '@filetool/integration-test-harness';

function createDmgBuffer(): Buffer {
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
				<string>Google Drive Partition</string>
				<key>Data</key>
				<data></data>
				<key>ID</key>
				<string>0</string>
				<key>Name</key>
				<string>Google Drive Partition</string>
			</dict>
		</array>
	</dict>
</dict>
</plist>`;

    const xmlBuffer = Buffer.from(xmlStr, 'utf-8');
    const xmlOffset = 1000;
    const xmlLength = xmlBuffer.length;

    // Total size 50,000 bytes
    const totalSize = 50000;
    const buf = Buffer.alloc(totalSize);

    // Copy XML at xmlOffset
    xmlBuffer.copy(buf, xmlOffset);

    // Construct koly trailer at totalSize - 512
    const kolyOffset = totalSize - 512;
    buf.write('koly', kolyOffset, 4, 'ascii');
    buf.writeUInt32BE(4, kolyOffset + 4);       // version = 4
    buf.writeUInt32BE(512, kolyOffset + 8);     // header_size = 512
    buf.writeUInt32BE(1, kolyOffset + 12);      // flags = 1
    buf.writeBigUInt64BE(BigInt(xmlOffset), kolyOffset + 216); // plist_offset
    buf.writeBigUInt64BE(BigInt(xmlLength), kolyOffset + 224); // plist_length

    return buf;
}

test('DMGViewer should open DMG file using range slicing', async ({ page }) => {
    const dmgBuf = createDmgBuffer();

    const iframe = await runHandlerTest(page, {
        handler: 'dmg-viewer',
        file: {
            content: dmgBuf,
            name: 'GoogleDrive.dmg',
            type: 'application/x-apple-diskimage'
        }
    });

    await expect(iframe.locator('table')).toBeVisible({ timeout: 15000 });
    await expect(iframe.locator('td', { hasText: 'Google Drive Partition' }).first()).toBeVisible();

    // Verify Open XML Plist button exists
    const plistBtn = iframe.locator('button', { hasText: 'Open XML Plist in Parent' });
    await expect(plistBtn).toBeVisible();
});

test('DMGViewer should open large 200MB DMG file without memory error', async ({ page }) => {
    await page.goto('/filetool/tests/integration/driver.html?handler=dmg-viewer');
    await page.waitForSelector('#file-handler-iframe', { state: 'attached', timeout: 10000 });

    await page.evaluate(() => {
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
				<string>Large 200MB Partition</string>
				<key>Data</key>
				<data></data>
				<key>ID</key>
				<string>0</string>
				<key>Name</key>
				<string>Large 200MB Partition</string>
			</dict>
		</array>
	</dict>
</dict>
</plist>`;

        const xmlEncoder = new TextEncoder();
        const xmlBuffer = xmlEncoder.encode(xmlStr);
        const xmlOffset = 1000;
        const xmlLength = xmlBuffer.length;

        // Create 200MB file using 200 chunks of 1MB Blob references
        const chunk = new Uint8Array(1024 * 1024);
        chunk.set(xmlBuffer, xmlOffset);

        const chunks: BlobPart[] = new Array(200).fill(new Uint8Array(1024 * 1024));
        chunks[0] = chunk;

        // Put koly trailer in last chunk (chunk 199)
        const lastChunk = new Uint8Array(1024 * 1024);
        const kolyOffset = 1024 * 1024 - 512;
        const koly = new Uint8Array(512);
        koly.set(new TextEncoder().encode('koly'), 0);
        const view = new DataView(koly.buffer);
        view.setUint32(4, 4, false); // version
        view.setUint32(8, 512, false); // header_size
        view.setUint32(12, 1, false); // flags
        view.setBigUint64(216, BigInt(xmlOffset), false); // plist_offset
        view.setBigUint64(224, BigInt(xmlLength), false); // plist_length

        lastChunk.set(koly, kolyOffset);
        chunks[199] = lastChunk;

        const file = new File(chunks, 'GoogleDrive.dmg', { type: 'application/x-apple-diskimage' });

        const iframe = document.getElementById('file-handler-iframe') as HTMLIFrameElement;
        iframe.contentWindow?.postMessage({
            action: 'respondFile',
            file: file
        }, '*');
    });

    const iframeEl = await page.$('#file-handler-iframe');
    const iframe = iframeEl ? await iframeEl.contentFrame() : null;
    if (!iframe) throw new Error('Could not find iframe');

    await expect(iframe.locator('table')).toBeVisible({ timeout: 15000 });
    await expect(iframe.locator('td', { hasText: 'Large 200MB Partition' }).first()).toBeVisible();
});
