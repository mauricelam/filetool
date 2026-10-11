/**
 * Information about a logical partition inside an Android super.img.
 */
export interface LpPartitionInfo {
    /** Name of the partition (e.g., "system_a", "vendor_a", "product") */
    name: string;
    /** Physical byte offset in the unsparsed super.img where this partition begins */
    startOffset: number;
    /** Size of the partition in bytes */
    sizeBytes: number;
}

/**
 * Parser for Android Logical Partition Metadata (lpmake / liblp / super.img).
 * Detects LP geometry header (magic 0x616C706D) and partition tables.
 */
export class LpMetadata {
    /**
     * Checks if the header buffer contains a valid LP metadata geometry header at offset 4096.
     */
    static isLpMetadata(headerData: Uint8Array): boolean {
        if (headerData.length < 4096 + 52) return false;
        const view = new DataView(headerData.buffer, headerData.byteOffset, headerData.byteLength);
        const magic = view.getUint32(4096, true);
        return magic === 0x616C706D; // LP_METADATA_GEOMETRY_MAGIC
    }

    /**
     * Parses the logical partition metadata from an unsparsed super.img header buffer.
     * Returns an array of LpPartitionInfo describing each logical partition and its byte range.
     */
    static parsePartitions(data: Uint8Array): LpPartitionInfo[] {
        if (data.length < 4096 + 52) return [];
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const magic = view.getUint32(4096, true);
        if (magic !== 0x616C706D) {
            return [];
        }

        const metadataMaxSize = view.getUint32(4096 + 40, true); // metadata_max_size

        const slotOffset = 4096 + metadataMaxSize;
        if (data.length < slotOffset + 104) {
            return [];
        }

        const headerMagic = view.getUint32(slotOffset, true);
        if (headerMagic !== 0x414C5030) { // LP_METADATA_HEADER_MAGIC
            return [];
        }

        const headerSize = view.getUint32(slotOffset + 8, true);
        const tablesOffset = slotOffset + headerSize;

        const partitionsOffset = view.getUint32(slotOffset + 80, true);
        const partitionsNumEntries = view.getUint32(slotOffset + 84, true);
        const partitionsEntrySize = view.getUint32(slotOffset + 88, true);

        const extentsOffset = view.getUint32(slotOffset + 92, true);
        const extentsNumEntries = view.getUint32(slotOffset + 96, true);
        const extentsEntrySize = view.getUint32(slotOffset + 100, true);

        const partStart = tablesOffset + partitionsOffset;
        const extStart = tablesOffset + extentsOffset;

        const results: LpPartitionInfo[] = [];

        for (let i = 0; i < partitionsNumEntries; i++) {
            const pOffset = partStart + i * partitionsEntrySize;
            if (pOffset + 52 > data.length) break;

            const nameBytes = new Uint8Array(data.buffer, data.byteOffset + pOffset, 36);
            let name = "";
            for (let b of nameBytes) {
                if (b === 0) break;
                name += String.fromCharCode(b);
            }

            if (!name || name === "default") continue;

            const firstExtentIndex = view.getUint32(pOffset + 40, true);
            const numExtents = view.getUint32(pOffset + 44, true);

            if (numExtents === 0) continue;

            for (let k = 0; k < numExtents; k++) {
                const eOffset = extStart + (firstExtentIndex + k) * extentsEntrySize;
                if (eOffset + 24 > data.length) break;

                const numSectors = view.getBigUint64(eOffset, true);
                const targetType = view.getUint32(eOffset + 8, true);
                const targetData = view.getBigUint64(eOffset + 12, true);

                if (targetType === 0) { // LINEAR
                    const startOffset = Number(targetData) * 512;
                    const sizeBytes = Number(numSectors) * 512;

                    if (sizeBytes > 0) {
                        results.push({
                            name,
                            startOffset,
                            sizeBytes
                        });
                    }
                }
            }
        }

        return results;
    }
}
