import * as flatbuffers from 'flatbuffers';

export class AnnotatedDecoder {
    private bb: flatbuffers.ByteBuffer;
    private visited = new Set<number>();
    private lines: string[] = [];

    constructor(data: Uint8Array) {
        this.bb = new flatbuffers.ByteBuffer(data);
    }

    decode(): string {
        this.lines = [];
        this.visited.clear();

        this.decodeHeader();

        const rootOffset = this.bb.readInt32(0);
        if (rootOffset > 0 && rootOffset < this.bb.capacity()) {
            this.decodeTable(rootOffset, "root table");
        }

        return this.lines.join('\n');
    }

    private addLine(offset: number, bytes: number[], comment: string | string[]) {
        const offsetStr = `+0x${offset.toString(16).padStart(4, '0')}`;
        const bytesStr = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');

        const comments = Array.isArray(comment) ? comment : [comment];

        this.lines.push(`${offsetStr} ${bytesStr.padEnd(12)} ; ${comments[0]}`);
        for (let i = 1; i < comments.length; i++) {
            this.lines.push(`${''.padEnd(offsetStr.length + 1)} ${''.padEnd(12)} ; ${comments[i]}`);
        }
    }

    private addSection(name: string) {
        this.lines.push(`\n${name}:\n`);
    }

    private decodeHeader() {
        this.addSection('header');
        const rootOffset = this.bb.readInt32(0);
        const bytes = Array.from(this.bb.bytes().slice(0, 4));
        this.addLine(0, bytes, `find root table at offset +0x${rootOffset.toString(16).padStart(8, '0')}.`);

        if (this.bb.capacity() >= 8) {
            const idBytes = this.bb.bytes().slice(4, 8);
            const idChars = Array.from(idBytes).map(b => `'${String.fromCharCode(b)}'`).join(', ');
            this.addLine(4, Array.from(idBytes), `possibly our file identifier: ${idChars}`);
        }
    }

    private decodeTable(offset: number, label: string) {
        if (this.visited.has(offset)) return;
        this.visited.add(offset);

        this.addSection('table');
        const vtableOffsetRel = this.bb.readInt32(offset);
        const vtableOffset = offset - vtableOffsetRel;

        const vtableBytes = Array.from(this.bb.bytes().slice(offset, offset + 4));
        const hexVal = vtableOffsetRel >>> 0;

        this.addLine(offset, vtableBytes, [
            `32-bit soffset to vtable location`,
            `two's complement: 2^32 - 0x${(0x100000000 - hexVal).toString(16)} = -0x${(Math.abs(vtableOffsetRel)).toString(16)}`,
            `effective address: +0x${offset.toString(16).padStart(4, '0')} - (-0x${(Math.abs(vtableOffsetRel)).toString(16)}) = +0x${vtableOffset.toString(16).padStart(4, '0')}`
        ]);

        // We need to find the vtable to know the fields
        if (vtableOffset < 0 || vtableOffset >= this.bb.capacity()) return;

        const vtableSize = this.bb.readUint16(vtableOffset);
        const tableSize = this.bb.readUint16(vtableOffset + 2);
        const numFields = (vtableSize - 4) / 2;
        const fieldOffsets: number[] = [];
        for (let i = 0; i < numFields; i++) {
            fieldOffsets.push(this.bb.readUint16(vtableOffset + 4 + i * 2));
        }

        // Display fields present in this table
        for (let i = 0; i < fieldOffsets.length; i++) {
            const fieldOff = fieldOffsets[i];
            if (fieldOff === 0) continue;
            const absFieldOff = offset + fieldOff;
            if (absFieldOff + 4 > this.bb.capacity()) continue;

            const val = this.bb.readInt32(absFieldOff);
            const target = absFieldOff + val;

            if (val > 0 && target < this.bb.capacity()) {
                 this.addLine(absFieldOff, Array.from(this.bb.bytes().slice(absFieldOff, absFieldOff + 4)), [
                    `32-bit uoffset field ${i}`,
                    `find object +0x${val.toString(16)} = ${val} bytes _from_ here`,
                    `= +0x${absFieldOff.toString(16).padStart(4, '0')} + 0x${val.toString(16)} = +0x${target.toString(16).padStart(4, '0')}.`
                 ]);
            } else {
                 this.addLine(absFieldOff, Array.from(this.bb.bytes().slice(absFieldOff, absFieldOff + 4)),
                    `field ${i} scalar (guessed): ${val}`);
            }
        }

        this.decodeVTable(vtableOffset);

        // Follow offsets
        for (let i = 0; i < fieldOffsets.length; i++) {
             const fieldOff = fieldOffsets[i];
             if (fieldOff === 0) continue;
             const absFieldOff = offset + fieldOff;
             if (absFieldOff + 4 > this.bb.capacity()) continue;
             const val = this.bb.readInt32(absFieldOff);
             const target = absFieldOff + val;
             if (val > 0 && target < this.bb.capacity()) {
                 this.decodeObject(target, `field ${i} target`);
             }
        }
    }

    private decodeVTable(offset: number) {
        if (this.visited.has(offset)) return;
        this.visited.add(offset);

        this.addSection('vtable');
        const vtableSize = this.bb.readUint16(offset);
        const tableSize = this.bb.readUint16(offset + 2);

        this.addLine(offset, Array.from(this.bb.bytes().slice(offset, offset + 2)), `vtable length = ${vtableSize} bytes`);
        this.addLine(offset + 2, Array.from(this.bb.bytes().slice(offset + 2, offset + 4)), `table length = ${tableSize} bytes`);

        const numFields = (vtableSize - 4) / 2;
        for (let i = 0; i < numFields; i++) {
            const off = this.bb.readUint16(offset + 4 + i * 2);
            this.addLine(offset + 4 + i * 2, Array.from(this.bb.bytes().slice(offset + 4 + i * 2, offset + 6 + i * 2)),
                `field id ${i}: ${off === 0 ? '<missing>' : `+0x${off.toString(16)}`}`);
        }
    }

    private decodeObject(offset: number, label: string) {
        if (this.visited.has(offset)) return;

        // Is it a string?
        const len = this.bb.readUint32(offset);
        if (len > 0 && len < 1000 && offset + 4 + len <= this.bb.capacity()) {
            const bytes = this.bb.bytes().slice(offset + 4, offset + 4 + len);
            let isPrintable = true;
            for (let i = 0; i < bytes.length; i++) {
                if (bytes[i] < 32 && bytes[i] !== 9 && bytes[i] !== 10 && bytes[i] !== 13) {
                    isPrintable = false;
                    break;
                }
            }
            if (isPrintable) {
                this.visited.add(offset);
                this.addSection('string');
                this.addLine(offset, Array.from(this.bb.bytes().slice(offset, offset + 4)), `vector element count (${len} ubyte elements)`);
                // Group by 2 bytes for the display as in example
                for (let i = 0; i < bytes.length; i += 2) {
                    const chunk = Array.from(bytes.slice(i, i + 2));
                    const chars = chunk.map(b => `'${String.fromCharCode(b)}'`).join(' ');
                    this.addLine(offset + 4 + i, chunk, `vector data: ${chars}`);
                }
                const lastByteOff = offset + 4 + len;
                if (lastByteOff < this.bb.capacity()) {
                    this.addLine(lastByteOff, [this.bb.readUint8(lastByteOff)], `zero termination`);
                }
                return;
            }
        }

        // Is it a table?
        const vtableOffsetRel = this.bb.readInt32(offset);
        const vtableOffset = offset - vtableOffsetRel;
        if (vtableOffsetRel !== 0 && vtableOffset >= 0 && vtableOffset < offset) {
             const maybeVTableSize = this.bb.readUint16(vtableOffset);
             if (maybeVTableSize >= 4) {
                this.decodeTable(offset, label);
                return;
             }
        }

        // Is it a vector?
        if (len >= 0 && len < 10000 && offset + 4 + len <= this.bb.capacity()) {
            this.visited.add(offset);
            this.addSection('vector');
            this.addLine(offset, Array.from(this.bb.bytes().slice(offset, offset + 4)), `vector element count = ${len}`);
            return;
        }
    }
}
