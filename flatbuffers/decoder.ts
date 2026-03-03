import * as flatbuffers from 'flatbuffers';

export interface FBNode {
    offset: number;
    size: number;
    type: 'table' | 'vtable' | 'string' | 'vector' | 'scalar' | 'offset' | 'root';
    value?: any;
    children?: FBNode[];
    description?: string;
}

export class StructuralDecoder {
    private bb: flatbuffers.ByteBuffer;
    private visited = new Set<number>();

    constructor(data: Uint8Array) {
        this.bb = new flatbuffers.ByteBuffer(data);
    }

    decode(): FBNode {
        const rootOffset = this.bb.readInt32(0);
        const nodes: FBNode[] = [];

        const rootNode: FBNode = {
            offset: 0,
            size: 4,
            type: 'root',
            description: 'Root Table Offset',
            value: rootOffset,
            children: []
        };

        if (rootOffset > 0 && rootOffset < this.bb.capacity()) {
            rootNode.children!.push(this.decodeTable(rootOffset, "Root Table"));
        }

        return rootNode;
    }

    private decodeTable(offset: number, label: string): FBNode {
        if (this.visited.has(offset)) {
            return { offset, size: 0, type: 'table', description: `${label} (already visited)` };
        }
        this.visited.add(offset);

        const vtableOffsetRel = this.bb.readInt32(offset);
        const vtableOffset = offset - vtableOffsetRel;

        const tableNode: FBNode = {
            offset: offset,
            size: 4, // Header size
            type: 'table',
            description: label,
            children: []
        };

        const vtableNode = this.decodeVTable(vtableOffset);
        tableNode.children!.push(vtableNode);

        // Field offsets from vtable
        const fieldOffsets = vtableNode.value as number[];
        for (let i = 0; i < fieldOffsets.length; i++) {
            const fieldOffset = fieldOffsets[i];
            if (fieldOffset === 0) continue;

            const absoluteFieldOffset = offset + fieldOffset;
            tableNode.children!.push(this.guessField(absoluteFieldOffset, `Field ${i}`));
        }

        return tableNode;
    }

    private decodeVTable(offset: number): FBNode {
        const vtableSize = this.bb.readUint16(offset);
        const tableSize = this.bb.readUint16(offset + 2);
        const numFields = (vtableSize - 4) / 2;
        const fieldOffsets: number[] = [];

        for (let i = 0; i < numFields; i++) {
            fieldOffsets.push(this.bb.readUint16(offset + 4 + i * 2));
        }

        return {
            offset: offset,
            size: vtableSize,
            type: 'vtable',
            description: `VTable (table size: ${tableSize})`,
            value: fieldOffsets,
            children: fieldOffsets.map((off, i) => ({
                offset: offset + 4 + i * 2,
                size: 2,
                type: 'scalar',
                description: `Field ${i} offset`,
                value: off
            }))
        };
    }

    private guessField(offset: number, label: string): FBNode {
        // FlatBuffers fields can be scalars or offsets.
        // We don't know the type, so we have to guess.
        // Heuristic: if it's a valid forward offset, it's likely a table, string, or vector.

        // This is tricky because we don't know the size of the scalar.
        // For now, let's assume it's a 4-byte offset if it looks like one.

        const val = this.bb.readInt32(offset);
        const targetOffset = offset + val;

        if (val > 0 && targetOffset < this.bb.capacity()) {
            // It might be an offset. Let's try to see what's there.
            return {
                offset: offset,
                size: 4,
                type: 'offset',
                description: `${label} (Offset)`,
                value: val,
                children: [this.guessObject(targetOffset, `${label} target`)]
            };
        }

        // Fallback: treat as a 4-byte scalar
        return {
            offset: offset,
            size: 4,
            type: 'scalar',
            description: `${label} (Scalar/Unknown)`,
            value: val
        };
    }

    private guessObject(offset: number, label: string): FBNode {
        if (offset < 0 || offset >= this.bb.capacity()) {
            return { offset, size: 0, type: 'scalar', description: `${label} (Out of bounds)` };
        }
        if (this.visited.has(offset)) {
            return { offset, size: 0, type: 'table', description: `${label} (already visited)` };
        }

        // Check if it's a string (prefixed by length, then null-terminated or valid UTF-8)
        const len = this.bb.readUint32(offset);
        if (len > 0 && len < 1024 * 1024 && offset + 4 + len <= this.bb.capacity()) {
            const bytes = this.bb.bytes().slice(offset + 4, offset + 4 + len);
            // Heuristic for string: check if it's printable
            let isPrintable = true;
            for (let i = 0; i < bytes.length; i++) {
                if (bytes[i] < 32 && bytes[i] !== 9 && bytes[i] !== 10 && bytes[i] !== 13) {
                    isPrintable = false;
                    break;
                }
            }
            if (isPrintable) {
                return {
                    offset: offset,
                    size: 4 + len,
                    type: 'string',
                    description: label,
                    value: new TextDecoder().decode(bytes)
                };
            }
        }

        // Check if it's a table (starts with a vtable offset that points backward)
        const vtableOffsetRel = this.bb.readInt32(offset);
        const vtableOffset = offset - vtableOffsetRel;
        if (vtableOffsetRel !== 0 && vtableOffset >= 0 && vtableOffset < offset) {
            const vtableSize = this.bb.readUint16(vtableOffset);
            if (vtableSize >= 4 && vtableOffset + vtableSize <= offset) {
                return this.decodeTable(offset, label);
            }
        }

        // Could be a vector. For now, just show raw bytes or a simple vector view.
        if (len >= 0 && len < 1024 * 1024 && offset + 4 + len <= this.bb.capacity()) {
             return {
                offset: offset,
                size: 4 + len,
                type: 'vector',
                description: `${label} (Vector of length ${len})`,
                value: `[... ${len} bytes ...]`
            };
        }

        return {
            offset: offset,
            size: 0,
            type: 'scalar',
            description: `${label} (Unknown Object)`
        };
    }
}
