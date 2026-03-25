import fs from 'fs';

function writeString(buf, str) {
    const bytes = Buffer.from(str, 'utf8');
    buf.push(bytes);
    buf.push(Buffer.from([0]));
}

function writeU32(buf, val) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(val);
    buf.push(b);
}

function writeU16(buf, val) {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(val);
    buf.push(b);
}

function writeU64(buf, val) {
    const b = Buffer.alloc(8);
    b.writeBigUInt64BE(BigInt(val));
    buf.push(b);
}

const chunks = [];
writeString(chunks, "JAVA PROFILE 1.0.1");
writeU32(chunks, 4);
writeU64(chunks, Date.now());

// Utf8 strings
const strings = [
    [10, "java.lang.Object"],
    [11, "com.test.Child"],
    [12, "myField"]
];

for (const [id, s] of strings) {
    chunks.push(Buffer.from([0x01]));
    writeU32(chunks, 100 + id);
    writeU32(chunks, 4 + s.length);
    writeU32(chunks, id);
    chunks.push(Buffer.from(s, 'utf8'));
}

// LoadClass
chunks.push(Buffer.from([0x02]));
writeU32(chunks, 200);
writeU32(chunks, 4 + 4 + 4 + 4);
writeU32(chunks, 1); // class serial
writeU32(chunks, 0x1234); // obj id
writeU32(chunks, 1); // stack trace
writeU32(chunks, 10); // name id 10 (Object)

chunks.push(Buffer.from([0x02]));
writeU32(chunks, 201);
writeU32(chunks, 4 + 4 + 4 + 4);
writeU32(chunks, 2); // class serial
writeU32(chunks, 0x1235); // obj id
writeU32(chunks, 1); // stack trace
writeU32(chunks, 11); // name id 11 (Child)

const subRecords = [];

// CLASS DUMP Object
subRecords.push(Buffer.from([0x20]));
writeU32(subRecords, 0x1234);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 8); // instance size
writeU16(subRecords, 0); // constant pool size
writeU16(subRecords, 0); // static fields count
writeU16(subRecords, 0); // instance fields count

// CLASS DUMP Child
subRecords.push(Buffer.from([0x20]));
writeU32(subRecords, 0x1235);
writeU32(subRecords, 0);
writeU32(subRecords, 0x1234); // super is Object
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 4); // instance size 4
writeU16(subRecords, 0); // constant pool size
writeU16(subRecords, 0); // static fields count
writeU16(subRecords, 1); // instance fields count
  writeU32(subRecords, 12); // name id 12 (myField)
  subRecords.push(Buffer.from([2])); // type 2 (object)

// INSTANCE DUMP of Object
subRecords.push(Buffer.from([0x21]));
writeU32(subRecords, 0x9001); // object id
writeU32(subRecords, 0);
writeU32(subRecords, 0x1234); // class id (Object)
writeU32(subRecords, 8); // data length
writeU32(subRecords, 0);
writeU32(subRecords, 0);

// INSTANCE DUMP of Child referencing the Object instance
subRecords.push(Buffer.from([0x21]));
writeU32(subRecords, 0x9002); // object id
writeU32(subRecords, 0);
writeU32(subRecords, 0x1235); // class id (Child)
writeU32(subRecords, 4); // data length
writeU32(subRecords, 0x9001); // ref to Object instance

const heapDumpContent = Buffer.concat(subRecords);
chunks.push(Buffer.from([0x1C]));
writeU32(chunks, 300);
writeU32(chunks, heapDumpContent.length);
chunks.push(heapDumpContent);

fs.writeFileSync('test.hprof', Buffer.concat(chunks));
console.log("Updated HPROF generated at: test.hprof");
