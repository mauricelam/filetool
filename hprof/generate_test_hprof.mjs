import fs from 'fs';

// Helper to write a null-terminated string
function writeString(buf, str) {
    const bytes = Buffer.from(str, 'utf8');
    buf.push(bytes);
    buf.push(Buffer.from([0]));
}

// Helper to write a big-endian u32
function writeU32(buf, val) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(val);
    buf.push(b);
}

// Helper to write a big-endian u16
function writeU16(buf, val) {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(val);
    buf.push(b);
}

// Helper to write a big-endian u64
function writeU64(buf, val) {
    const b = Buffer.alloc(8);
    b.writeBigUInt64BE(BigInt(val));
    buf.push(b);
}

const chunks = [];

// Header
writeString(chunks, "JAVA PROFILE 1.0.1");
writeU32(chunks, 4); // ID size
writeU64(chunks, Date.now()); // timestamp

// Record 0: UTF-8
chunks.push(Buffer.from([0x01])); // TAG: UTF-8
writeU32(chunks, 100); // Time
writeU32(chunks, 4 + 16); // Length: ID(4) + string
writeU32(chunks, 1); // ID
chunks.push(Buffer.from("java.lang.Object", 'utf8'));

// Record 1: Load Class
chunks.push(Buffer.from([0x02])); // TAG: Load Class
writeU32(chunks, 200); // Time
writeU32(chunks, 4 + 4 + 4 + 4); // Length: serial(4) + objid(4) + stackid(4) + nameid(4)
writeU32(chunks, 1); // serial
writeU32(chunks, 0x1234); // class obj id
writeU32(chunks, 1); // stack trace serial
writeU32(chunks, 1); // name id (points to Record 0)

// Record 2: Heap Dump Segment
const subRecords = [];
// Sub-record: GC ROOT JNI GLOBAL
subRecords.push(Buffer.from([0x01])); // Sub-tag: GC ROOT JNI GLOBAL
writeU32(subRecords, 0x5678); // object id
writeU32(subRecords, 0x9012); // global ref id

// Sub-record: CLASS DUMP
subRecords.push(Buffer.from([0x20])); // Sub-tag: CLASS DUMP
writeU32(subRecords, 0x1234); // class obj id
writeU32(subRecords, 0); // stack trace serial
writeU32(subRecords, 0); // super class obj id
writeU32(subRecords, 0); // class loader obj id
writeU32(subRecords, 0); // signers obj id
writeU32(subRecords, 0); // protection domain obj id
writeU32(subRecords, 0); // reserved
writeU32(subRecords, 0); // reserved
writeU32(subRecords, 0); // instance size
writeU16(subRecords, 0); // constant pool count (u16)
writeU16(subRecords, 0); // static field count (u16)
writeU16(subRecords, 0); // instance field count (u16)

const heapDumpContent = Buffer.concat(subRecords);
chunks.push(Buffer.from([0x1C])); // TAG: Heap Dump Segment
writeU32(chunks, 300); // Time
writeU32(chunks, heapDumpContent.length); // Length
chunks.push(heapDumpContent);

fs.writeFileSync('hprof/test.hprof', Buffer.concat(chunks));
console.log("Minimal HPROF generated at: hprof/test.hprof");
