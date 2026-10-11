/**
 * Information about an extent belonging to a logical partition in super.img.
 */
export interface LpExtentInfo {
    /** Physical byte offset in the unsparsed super.img where this extent starts */
    offset: number;
    /** Size of the extent in bytes */
    size: number;
    /** Target type: 0 = LINEAR, 1 = ZERO */
    targetType: number;
}

/**
 * Information about a logical partition inside an Android super.img.
 */
export interface LpPartitionInfo {
    /** Name of the partition (e.g., "system_a", "vendor_a", "product") */
    name: string;
    /** Extents composing this partition */
    extents: LpExtentInfo[];
    /** Physical byte offset of the first extent (for backward compatibility) */
    startOffset: number;
    /** Total size of the partition in bytes across all extents */
    sizeBytes: number;
}

/**
 * Constants from Android liblp / lpunpack.py
 */
export const LP_PARTITION_RESERVED_BYTES = 4096;
export const LP_METADATA_GEOMETRY_MAGIC = 0x616C4467; // "gDlA"
export const LP_METADATA_GEOMETRY_MAGIC_LEGACY = 0x616C706D;
export const LP_METADATA_GEOMETRY_SIZE = 4096;
export const LP_METADATA_HEADER_MAGIC = 0x414C5030; // "0PLA"
export const LP_SECTOR_SIZE = 512;

export const LP_TARGET_TYPE_LINEAR = 0;
export const LP_TARGET_TYPE_ZERO = 1;

/**
 * Parser for Android Logical Partition Metadata (lpmake / liblp / super.img).
 * Detects LP geometry header (magic 0x616C4467 or 0x616C706D) and partition tables.
 */
export class LpMetadata {
    /**
     * Checks if the header buffer contains a valid LP metadata geometry header at offset 4096 or offset 8192.
     */
    static isLpMetadata(headerData: Uint8Array): boolean {
        if (headerData.length < 4096 + 52) return false;
        const view = new DataView(headerData.buffer, headerData.byteOffset, headerData.byteLength);

        const checkMagicAt = (off: number) => {
            if (headerData.length < off + 52) return false;
            const magic = view.getUint32(off, true);
            return magic === LP_METADATA_GEOMETRY_MAGIC || magic === LP_METADATA_GEOMETRY_MAGIC_LEGACY;
        };

        return checkMagicAt(4096) || checkMagicAt(8192);
    }

    /**
     * Parses the logical partition metadata from an unsparsed super.img header buffer.
     * Returns an array of LpPartitionInfo describing each logical partition and its byte range.
     */
    static parsePartitions(data: Uint8Array): LpPartitionInfo[] {
        if (data.length < 4096 + 52) return [];
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        let geomOffset = -1;
        if (data.length >= 4096 + 52) {
            const m = view.getUint32(4096, true);
            if (m === LP_METADATA_GEOMETRY_MAGIC || m === LP_METADATA_GEOMETRY_MAGIC_LEGACY) {
                geomOffset = 4096;
            }
        }
        if (geomOffset === -1 && data.length >= 8192 + 52) {
            const m = view.getUint32(8192, true);
            if (m === LP_METADATA_GEOMETRY_MAGIC || m === LP_METADATA_GEOMETRY_MAGIC_LEGACY) {
                geomOffset = 8192;
            }
        }

        if (geomOffset === -1) {
            return [];
        }

        const metadataMaxSize = view.getUint32(geomOffset + 40, true);
        const metadataSlotCount = view.getUint32(geomOffset + 44, true);

        if (metadataSlotCount === 0 || metadataMaxSize === 0) {
            return [];
        }

        // Standard offsets according to lpunpack.py / liblp:
        // base = LP_PARTITION_RESERVED_BYTES + (LP_METADATA_GEOMETRY_SIZE * 2) = 12288 (0x3000)
        const baseOffset = LP_PARTITION_RESERVED_BYTES + (LP_METADATA_GEOMETRY_SIZE * 2);
        const candidateSlotOffsets: number[] = [
            baseOffset, // Slot 0 primary
            baseOffset + metadataMaxSize * metadataSlotCount, // Slot 0 backup
            4096 + metadataMaxSize // legacy fallback offset
        ];

        let slotOffset = -1;
        for (const candidate of candidateSlotOffsets) {
            if (data.length >= candidate + 104) {
                const headerMagic = view.getUint32(candidate, true);
                if (headerMagic === LP_METADATA_HEADER_MAGIC) {
                    slotOffset = candidate;
                    break;
                }
            }
        }

        if (slotOffset === -1) {
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

            const extents: LpExtentInfo[] = [];
            let totalSizeBytes = 0;

            for (let k = 0; k < numExtents; k++) {
                const eIdx = firstExtentIndex + k;
                if (eIdx >= extentsNumEntries) break;

                const eOffset = extStart + eIdx * extentsEntrySize;
                if (eOffset + 24 > data.length) break;

                const numSectors = view.getBigUint64(eOffset, true);
                const targetType = view.getUint32(eOffset + 8, true);
                const targetData = view.getBigUint64(eOffset + 12, true);

                const sizeBytes = Number(numSectors) * LP_SECTOR_SIZE;
                const offsetBytes = targetType === LP_TARGET_TYPE_LINEAR ? Number(targetData) * LP_SECTOR_SIZE : 0;

                if (sizeBytes > 0) {
                    extents.push({
                        offset: offsetBytes,
                        size: sizeBytes,
                        targetType
                    });
                    totalSizeBytes += sizeBytes;
                }
            }

            if (extents.length > 0) {
                results.push({
                    name,
                    extents,
                    startOffset: extents[0].offset,
                    sizeBytes: totalSizeBytes
                });
            }
        }

        return results;
    }
}
