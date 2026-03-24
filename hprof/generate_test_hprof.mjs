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

chunks.push(Buffer.from([0x01]));
writeU32(chunks, 100);
writeU32(chunks, 4 + 16);
writeU32(chunks, 10); // name id 10
chunks.push(Buffer.from("java.lang.Object", 'utf8'));

chunks.push(Buffer.from([0x01]));
writeU32(chunks, 101);
writeU32(chunks, 4 + 14);
writeU32(chunks, 11); // name id 11
chunks.push(Buffer.from("com.test.Child", 'utf8'));

chunks.push(Buffer.from([0x02]));
writeU32(chunks, 200);
writeU32(chunks, 4 + 4 + 4 + 4);
writeU32(chunks, 1); // class serial
writeU32(chunks, 0x1234); // obj id
writeU32(chunks, 1); // stack trace
writeU32(chunks, 10); // name id 10

chunks.push(Buffer.from([0x02]));
writeU32(chunks, 201);
writeU32(chunks, 4 + 4 + 4 + 4);
writeU32(chunks, 2); // class serial
writeU32(chunks, 0x1235); // obj id
writeU32(chunks, 1); // stack trace
writeU32(chunks, 11); // name id 11

const subRecords = [];
subRecords.push(Buffer.from([0x01]));
writeU32(subRecords, 0x5678);
writeU32(subRecords, 0x9012);

subRecords.push(Buffer.from([0x20])); // CLASS DUMP Object
writeU32(subRecords, 0x1234);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 16);
writeU16(subRecords, 0);
writeU16(subRecords, 0);
writeU16(subRecords, 0);

subRecords.push(Buffer.from([0x20])); // CLASS DUMP Child
writeU32(subRecords, 0x1235);
writeU32(subRecords, 0);
writeU32(subRecords, 0x1234); // super is Object
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 0);
writeU32(subRecords, 24);
writeU16(subRecords, 0);
writeU16(subRecords, 0);
writeU16(subRecords, 0);

subRecords.push(Buffer.from([0x21])); // INSTANCE DUMP
writeU32(subRecords, 0x5678); // object id
writeU32(subRecords, 0); // stack trace
writeU32(subRecords, 0x1235); // class id (Child)
writeU32(subRecords, 0); // data length

const heapDumpContent = Buffer.concat(subRecords);
chunks.push(Buffer.from([0x1C]));
writeU32(chunks, 300);
writeU32(chunks, heapDumpContent.length);
chunks.push(heapDumpContent);

fs.writeFileSync('test.hprof', Buffer.concat(chunks));
console.log("Minimal HPROF generated at: test.hprof");
