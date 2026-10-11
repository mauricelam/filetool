/**
 * Interface representing a chunk in an Android sparse image file.
 */
export interface SparseChunk {
    /** Chunk type: RAW (data), FILL (pattern repeat), DONT_CARE (unallocated/zeros) */
    type: 'RAW' | 'FILL' | 'DONT_CARE';
    /** Starting output byte offset in the unsparsed image */
    outByteStart: number;
    /** Ending output byte offset in the unsparsed image */
    outByteEnd: number;
    /** Byte offset of payload in sparse file (for RAW chunks) */
    payloadFileOffset?: number;
    /** 4-byte fill pattern (for FILL chunks) */
    fillPattern?: Uint8Array;
}

/**
 * Handles parsing and on-demand byte reading for Android sparse images (magic 0xED26FF3A).
 * Unsparses chunk ranges on demand without loading full expanded images into memory.
 */
export class SparseImage {
    file: File | Uint8Array;
    totalBlocks: number;
    blockSize: number;
    unsparsedSize: number;
    chunks: SparseChunk[];

    constructor(file: File | Uint8Array, totalBlocks: number, blockSize: number, chunks: SparseChunk[]) {
        this.file = file;
        this.totalBlocks = totalBlocks;
        this.blockSize = blockSize;
        this.unsparsedSize = totalBlocks * blockSize;
        this.chunks = chunks;
    }

    /**
     * Checks if the given buffer starts with a valid Android sparse image header (0xED26FF3A v1.0).
     */
    static isSparseHeader(data: Uint8Array): boolean {
        if (data.length < 28) return false;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const magic = view.getUint32(0, true);
        const majorVersion = view.getUint16(4, true);
        return magic === 0xED26FF3A && majorVersion === 1;
    }

    /**
     * Asynchronously creates a SparseImage instance by parsing header and chunk tables.
     */
    static async create(file: File | Uint8Array): Promise<SparseImage> {
        let headerData: Uint8Array;
        if (file instanceof File) {
            const buf = await file.slice(0, 28).arrayBuffer();
            headerData = new Uint8Array(buf);
        } else {
            headerData = file.subarray(0, 28);
        }

        if (!SparseImage.isSparseHeader(headerData)) {
            throw new Error("Invalid Android sparse image header");
        }

        const view = new DataView(headerData.buffer, headerData.byteOffset, headerData.byteLength);
        const fileHdrSz = view.getUint16(8, true);
        const chunkHdrSz = view.getUint16(10, true);
        const blkSz = view.getUint32(12, true);
        const totalBlks = view.getUint32(16, true);
        const totalChunks = view.getUint32(20, true);

        const chunks: SparseChunk[] = [];
        let fileOffset = fileHdrSz;
        let outBlock = 0;

        for (let i = 0; i < totalChunks; i++) {
            let chunkHdrData: Uint8Array;
            if (file instanceof File) {
                chunkHdrData = SparseImage.readSliceSync(file, fileOffset, chunkHdrSz);
            } else {
                chunkHdrData = file.subarray(fileOffset, fileOffset + chunkHdrSz);
            }

            if (chunkHdrData.length < 12) {
                break;
            }

            const cView = new DataView(chunkHdrData.buffer, chunkHdrData.byteOffset, chunkHdrData.byteLength);
            const chunkType = cView.getUint16(0, true);
            const chunkSzBlocks = cView.getUint32(4, true);
            const totalSzBytes = cView.getUint32(8, true);

            const outByteStart = outBlock * blkSz;
            const outByteEnd = (outBlock + chunkSzBlocks) * blkSz;

            if (chunkType === 0xCAC1) {
                // RAW
                chunks.push({
                    type: 'RAW',
                    outByteStart,
                    outByteEnd,
                    payloadFileOffset: fileOffset + chunkHdrSz
                });
                outBlock += chunkSzBlocks;
            } else if (chunkType === 0xCAC2) {
                // FILL
                let fillPattern: Uint8Array;
                if (file instanceof File) {
                    fillPattern = SparseImage.readSliceSync(file, fileOffset + chunkHdrSz, 4);
                } else {
                    fillPattern = file.subarray(fileOffset + chunkHdrSz, fileOffset + chunkHdrSz + 4);
                }
                chunks.push({
                    type: 'FILL',
                    outByteStart,
                    outByteEnd,
                    fillPattern
                });
                outBlock += chunkSzBlocks;
            } else if (chunkType === 0xCAC3) {
                // DONT_CARE
                chunks.push({
                    type: 'DONT_CARE',
                    outByteStart,
                    outByteEnd
                });
                outBlock += chunkSzBlocks;
            } else if (chunkType === 0xCAC4) {
                // CRC32 - ignore
            } else {
                console.warn(`Unknown sparse chunk type: 0x${chunkType.toString(16)} at offset ${fileOffset}`);
            }

            fileOffset += totalSzBytes;
        }

        return new SparseImage(file, totalBlks, blkSz, chunks);
    }

    private static readSliceSync(file: File, offset: number, length: number): Uint8Array {
        const slice = file.slice(offset, offset + length);
        if (typeof FileReaderSync !== 'undefined') {
            const reader = new FileReaderSync();
            const ab = reader.readAsArrayBuffer(slice);
            return new Uint8Array(ab);
        } else {
            const blobUrl = URL.createObjectURL(slice);
            const xhr = new XMLHttpRequest();
            xhr.open('GET', blobUrl, false);
            xhr.overrideMimeType('text/plain; charset=x-user-defined');
            xhr.send(null);
            URL.revokeObjectURL(blobUrl);

            const out = new Uint8Array(slice.size);
            if (xhr.status === 200 || xhr.status === 0) {
                const text = xhr.responseText;
                const len = Math.min(out.length, text.length);
                for (let i = 0; i < len; i++) {
                    out[i] = text.charCodeAt(i) & 0xff;
                }
            }
            return out;
        }
    }

    private findChunk(pos: number): SparseChunk | null {
        let low = 0;
        let high = this.chunks.length - 1;
        while (low <= high) {
            const mid = (low + high) >> 1;
            const chunk = this.chunks[mid];
            if (pos < chunk.outByteStart) {
                high = mid - 1;
            } else if (pos >= chunk.outByteEnd) {
                low = mid + 1;
            } else {
                return chunk;
            }
        }
        return null;
    }

    /**
     * Synchronously reads a range of bytes from the unsparsed virtual image.
     * Uses binary search to map unsparsed offsets to sparse chunks on demand.
     */
    readSync(unsparseOffset: number, length: number, targetBuf?: Uint8Array, targetOffset = 0): Uint8Array {
        const outBuf = targetBuf || new Uint8Array(length);
        if (unsparseOffset >= this.unsparsedSize || length <= 0) {
            return outBuf.subarray(targetOffset, targetOffset);
        }

        const bytesToRead = Math.min(length, this.unsparsedSize - unsparseOffset);
        let bytesRead = 0;

        while (bytesRead < bytesToRead) {
            const currentPos = unsparseOffset + bytesRead;
            const chunk = this.findChunk(currentPos);
            if (!chunk) {
                const fillLen = bytesToRead - bytesRead;
                outBuf.fill(0, targetOffset + bytesRead, targetOffset + bytesRead + fillLen);
                bytesRead += fillLen;
                break;
            }

            const chunkRemaining = chunk.outByteEnd - currentPos;
            const toReadInChunk = Math.min(bytesToRead - bytesRead, chunkRemaining);
            const chunkOffset = currentPos - chunk.outByteStart;

            if (chunk.type === 'RAW') {
                const rawFileOffset = chunk.payloadFileOffset! + chunkOffset;
                if (this.file instanceof File) {
                    const chunkData = SparseImage.readSliceSync(this.file, rawFileOffset, toReadInChunk);
                    outBuf.set(chunkData, targetOffset + bytesRead);
                } else {
                    outBuf.set(this.file.subarray(rawFileOffset, rawFileOffset + toReadInChunk), targetOffset + bytesRead);
                }
            } else if (chunk.type === 'FILL') {
                const pattern = chunk.fillPattern!;
                const dstStart = targetOffset + bytesRead;
                for (let i = 0; i < toReadInChunk; i++) {
                    outBuf[dstStart + i] = pattern[(chunkOffset + i) % 4];
                }
            } else {
                // DONT_CARE
                outBuf.fill(0, targetOffset + bytesRead, targetOffset + bytesRead + toReadInChunk);
            }

            bytesRead += toReadInChunk;
        }

        return outBuf.subarray(targetOffset, targetOffset + bytesRead);
    }

    /**
     * Unsparses the Android sparse image into a single standard Blob/File.
     * Uses zero-copy File slices for RAW chunks, pattern Blobs for FILL chunks,
     * and 64MB-sub-Blob hierarchies for DONT_CARE chunks.
     * Works instantly for any size (even >17.5 GB!) with zero memory overhead.
     */
    toUnsparsedBlob(fileName: string): File {
        if (this.file instanceof Uint8Array) {
            const unsparsedData = this.readSync(0, this.unsparsedSize);
            return new File([unsparsedData], fileName, { type: 'application/octet-stream' });
        }

        const sharedZero = new ArrayBuffer(64 * 1024); // 64 KB shared buffer
        const zero64MBParts: ArrayBuffer[] = [];
        for (let i = 0; i < 1024; i++) zero64MBParts.push(sharedZero);
        const zero64MB = new Blob(zero64MBParts);

        const createZeroBlob = (sizeBytes: number): Blob => {
            const num64MB = Math.floor(sizeBytes / (64 * 1024 * 1024));
            const remainder = sizeBytes % (64 * 1024 * 1024);
            const parts: BlobPart[] = [];
            for (let i = 0; i < num64MB; i++) {
                parts.push(zero64MB);
            }
            if (remainder > 0) {
                const num64k = Math.floor(remainder / (64 * 1024));
                const remBytes = remainder % (64 * 1024);
                for (let i = 0; i < num64k; i++) {
                    parts.push(sharedZero);
                }
                if (remBytes > 0) {
                    parts.push(new ArrayBuffer(remBytes));
                }
            }
            return new Blob(parts);
        };

        const createFillBlob = (pattern: Uint8Array, sizeBytes: number): Blob => {
            const fillUnit = new Uint8Array(64 * 1024);
            for (let i = 0; i < fillUnit.length; i++) {
                fillUnit[i] = pattern[i % 4];
            }
            const num64k = Math.floor(sizeBytes / (64 * 1024));
            const remainder = sizeBytes % (64 * 1024);
            const parts: BlobPart[] = [];
            for (let i = 0; i < num64k; i++) {
                parts.push(fillUnit);
            }
            if (remainder > 0) {
                const remBuf = new Uint8Array(remainder);
                for (let i = 0; i < remainder; i++) {
                    remBuf[i] = pattern[i % 4];
                }
                parts.push(remBuf);
            }
            return new Blob(parts);
        };

        const parts: BlobPart[] = [];
        const sparseFile = this.file as File;

        for (const chunk of this.chunks) {
            const chunkLen = chunk.outByteEnd - chunk.outByteStart;
            if (chunkLen <= 0) continue;

            if (chunk.type === 'RAW') {
                parts.push(sparseFile.slice(chunk.payloadFileOffset!, chunk.payloadFileOffset! + chunkLen));
            } else if (chunk.type === 'FILL' && chunk.fillPattern) {
                parts.push(createFillBlob(chunk.fillPattern, chunkLen));
            } else {
                // DONT_CARE
                parts.push(createZeroBlob(chunkLen));
            }
        }

        const unsparsedBlob = new Blob(parts, { type: 'application/octet-stream' });
        return new File([unsparsedBlob], fileName, { type: 'application/octet-stream' });
    }
}

/**
 * Wraps a sub-region (offset and size) of a SparseImage or raw File object.
 * Used for inspecting logical partitions inside super.img without copying.
 */
export class SparseSubImage {
    parent: SparseImage | File;
    offset: number;
    unsparsedSize: number;

    constructor(parent: SparseImage | File, offset: number, sizeBytes: number) {
        this.parent = parent;
        this.offset = offset;
        this.unsparsedSize = sizeBytes;
    }

    /**
     * Synchronously reads a range of bytes relative to this sub-image offset.
     */
    readSync(unsparseOffset: number, length: number): Uint8Array {
        const actualPos = this.offset + unsparseOffset;
        const parentSize = this.parent instanceof SparseImage ? this.parent.unsparsedSize : this.parent.size;
        if (actualPos >= parentSize) {
            return new Uint8Array(0);
        }
        const bytesToRead = Math.min(length, this.unsparsedSize - unsparseOffset);
        if (bytesToRead <= 0) {
            return new Uint8Array(0);
        }

        if (this.parent instanceof SparseImage) {
            return this.parent.readSync(actualPos, bytesToRead);
        } else {
            const slice = this.parent.slice(actualPos, actualPos + bytesToRead);
            if (typeof FileReaderSync !== 'undefined') {
                const reader = new FileReaderSync();
                const ab = reader.readAsArrayBuffer(slice);
                return new Uint8Array(ab);
            } else {
                const blobUrl = URL.createObjectURL(slice);
                const xhr = new XMLHttpRequest();
                xhr.open('GET', blobUrl, false);
                xhr.overrideMimeType('text/plain; charset=x-user-defined');
                xhr.send(null);
                URL.revokeObjectURL(blobUrl);

                const out = new Uint8Array(bytesToRead);
                if (xhr.status === 200 || xhr.status === 0) {
                    const text = xhr.responseText;
                    const len = Math.min(out.length, text.length);
                    for (let i = 0; i < len; i++) {
                        out[i] = text.charCodeAt(i) & 0xff;
                    }
                }
                return out;
            }
        }
    }
}
