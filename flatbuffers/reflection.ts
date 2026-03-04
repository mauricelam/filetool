import * as flatbuffers from 'flatbuffers';

export enum BaseType {
    None = 0,
    UType = 1,
    Bool = 2,
    Byte = 3,
    UByte = 4,
    Short = 5,
    UShort = 6,
    Int = 7,
    UInt = 8,
    Long = 9,
    ULong = 10,
    Float = 11,
    Double = 12,
    String = 13,
    Vector = 14,
    Obj = 15,
    Union = 16,
    Array = 17,
    Vector64 = 18,
    MaxBaseType = 19
}

interface Table {
    bb: flatbuffers.ByteBuffer;
    bb_pos: number;
}

function __offset(t: Table, vtable_offset: number): number {
    const vtable = t.bb_pos - t.bb.readInt32(t.bb_pos);
    const vtable_size = t.bb.readUint16(vtable);
    return vtable_offset < vtable_size ? t.bb.readUint16(vtable + vtable_offset) : 0;
}

function __indirect(t: Table, offset: number): number {
    return offset + t.bb.readInt32(offset);
}

function __vector_len(t: Table, offset: number): number {
    let off = offset;
    off += t.bb.readInt32(off);
    return t.bb.readInt32(off);
}

function __vector(t: Table, offset: number): number {
    let off = offset;
    return off + t.bb.readInt32(off) + 4;
}

function __string(t: Table, offset: number): string | null {
    let off = offset + t.bb.readInt32(offset);
    const length = t.bb.readInt32(off);
    const bytes = t.bb.bytes();
    return new TextDecoder().decode(bytes.slice(off + 4, off + 4 + length));
}

function __byte(t: Table, offset: number): number {
    return t.bb.readInt8(offset);
}

export function decodeReflectionSchema(data: Uint8Array): any {
    const bb = new flatbuffers.ByteBuffer(data);
    const rootTable: Table = {
        bb: bb,
        bb_pos: bb.readInt32(bb.position()) + bb.position()
    };

    return readSchema(rootTable);
}

function readString(table: Table, offset: number): string | null {
    const off = __offset(table, offset);
    return off ? __string(table, table.bb_pos + off) : null;
}

function readTable<T>(table: Table, offset: number, reader: (t: Table) => T): T | null {
    const off = __offset(table, offset);
    if (!off) return null;
    const subTable: Table = {
        bb: table.bb,
        bb_pos: __indirect(table, table.bb_pos + off)
    };
    return reader(subTable);
}

function readVector<T>(table: Table, offset: number, reader: (t: Table) => T): T[] {
    const off = __offset(table, offset);
    if (!off) return [];
    const len = __vector_len(table, table.bb_pos + off);
    const result: T[] = [];
    const vectorStart = __vector(table, table.bb_pos + off);
    for (let i = 0; i < len; i++) {
        const subTable: Table = {
            bb: table.bb,
            bb_pos: __indirect(table, vectorStart + i * 4)
        };
        result.push(reader(subTable));
    }
    return result;
}

function readScalarVector<T>(table: Table, offset: number, elementSize: number, reader: (table: Table, pos: number) => T): T[] {
    const off = __offset(table, offset);
    if (!off) return [];
    const len = __vector_len(table, table.bb_pos + off);
    const result: T[] = [];
    const start = __vector(table, table.bb_pos + off);
    for (let i = 0; i < len; i++) {
        result.push(reader(table, start + i * elementSize));
    }
    return result;
}

function readSchema(table: Table): any {
    return {
        objects: readVector(table, 4, readObject),
        enums: readVector(table, 6, readEnum),
        file_ident: readString(table, 8),
        file_ext: readString(table, 10),
        root_table: readTable(table, 12, readObject),
        services: readVector(table, 14, readService),
        // advanced_features: 16 (ulong)
        fbs_files: readVector(table, 18, readSchemaFile)
    };
}

function readObject(table: Table): any {
    const off8 = __offset(table, 8);
    const off10 = __offset(table, 10);
    const off12 = __offset(table, 12);

    return {
        name: readString(table, 4),
        fields: readVector(table, 6, readField),
        is_struct: off8 ? !!__byte(table, table.bb_pos + off8) : false,
        minalign: off10 ? table.bb.readInt32(table.bb_pos + off10) : 0,
        bytesize: off12 ? table.bb.readInt32(table.bb_pos + off12) : 0,
        attributes: readVector(table, 14, readKeyValue),
        documentation: readScalarVector(table, 16, 4, (t, pos) => __string(t, pos)),
        declaration_file: readString(table, 18)
    };
}

function readField(table: Table): any {
    const off8 = __offset(table, 8);
    const off10 = __offset(table, 10);
    const off12 = __offset(table, 12);
    const off14 = __offset(table, 14);
    const off16 = __offset(table, 16);
    const off18 = __offset(table, 18);
    const off20 = __offset(table, 20);
    const off26 = __offset(table, 26);
    const off28 = __offset(table, 28);
    const off30 = __offset(table, 30);

    return {
        name: readString(table, 4),
        type: readTable(table, 6, readType),
        id: off8 ? table.bb.readUint16(table.bb_pos + off8) : 0,
        offset: off10 ? table.bb.readUint16(table.bb_pos + off10) : 0,
        default_integer: off12 ? Number(table.bb.readInt64(table.bb_pos + off12)) : 0,
        default_real: off14 ? table.bb.readFloat64(table.bb_pos + off14) : 0.0,
        deprecated: off16 ? !!__byte(table, table.bb_pos + off16) : false,
        required: off18 ? !!__byte(table, table.bb_pos + off18) : false,
        key: off20 ? !!__byte(table, table.bb_pos + off20) : false,
        attributes: readVector(table, 22, readKeyValue),
        documentation: readScalarVector(table, 24, 4, (t, pos) => __string(t, pos)),
        optional: off26 ? !!__byte(table, table.bb_pos + off26) : false,
        padding: off28 ? table.bb.readUint16(table.bb_pos + off28) : 0,
        offset64: off30 ? !!__byte(table, table.bb_pos + off30) : false
    };
}

function readType(table: Table): any {
    const off4 = __offset(table, 4);
    const off6 = __offset(table, 6);
    const off8 = __offset(table, 8);
    const off10 = __offset(table, 10);
    const off12 = __offset(table, 12);
    const off14 = __offset(table, 14);

    return {
        base_type: BaseType[off4 ? table.bb.readInt8(table.bb_pos + off4) : 0],
        element: BaseType[off6 ? table.bb.readInt8(table.bb_pos + off6) : 0],
        index: off8 ? table.bb.readInt32(table.bb_pos + off8) : -1,
        fixed_length: off10 ? table.bb.readUint16(table.bb_pos + off10) : 0,
        base_size: off12 ? table.bb.readUint32(table.bb_pos + off12) : 4,
        element_size: off14 ? table.bb.readUint32(table.bb_pos + off14) : 0
    };
}

function readEnum(table: Table): any {
    const off8 = __offset(table, 8);

    return {
        name: readString(table, 4),
        values: readVector(table, 6, readEnumVal),
        is_union: off8 ? !!__byte(table, table.bb_pos + off8) : false,
        underlying_type: readTable(table, 10, readType),
        attributes: readVector(table, 12, readKeyValue),
        documentation: readScalarVector(table, 14, 4, (t, pos) => __string(t, pos)),
        declaration_file: readString(table, 16)
    };
}

function readEnumVal(table: Table): any {
    const off6 = __offset(table, 6);

    return {
        name: readString(table, 4),
        value: off6 ? Number(table.bb.readInt64(table.bb_pos + off6)) : 0,
        union_type: readTable(table, 10, readType),
        documentation: readScalarVector(table, 12, 4, (t, pos) => __string(t, pos)),
        attributes: readVector(table, 14, readKeyValue)
    };
}

function readKeyValue(table: Table): any {
    return {
        key: readString(table, 4),
        value: readString(table, 6)
    };
}

function readService(table: Table): any {
    return {
        name: readString(table, 4),
        calls: readVector(table, 6, readRPCCall),
        attributes: readVector(table, 8, readKeyValue),
        documentation: readScalarVector(table, 10, 4, (t, pos) => __string(t, pos)),
        declaration_file: readString(table, 12)
    };
}

function readRPCCall(table: Table): any {
    return {
        name: readString(table, 4),
        request: readTable(table, 6, readObject),
        response: readTable(table, 8, readObject),
        attributes: readVector(table, 10, readKeyValue),
        documentation: readScalarVector(table, 12, 4, (t, pos) => __string(t, pos))
    };
}

function readSchemaFile(table: Table): any {
    return {
        filename: readString(table, 4),
        included_filenames: readScalarVector(table, 6, 4, (t, pos) => __string(t, pos))
    };
}
