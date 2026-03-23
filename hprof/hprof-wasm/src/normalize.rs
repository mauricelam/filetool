use std::convert::TryInto;

fn get_u16(data: &[u8], pos: usize) -> u16 {
    u16::from_be_bytes(data[pos..pos + 2].try_into().unwrap_or([0; 2]))
}

fn get_u32(data: &[u8], pos: usize) -> u32 {
    u32::from_be_bytes(data[pos..pos + 4].try_into().unwrap_or([0; 4]))
}

fn compute_basic_len(tag: u8, id_size: usize) -> Option<usize> {
    match tag {
        2 => Some(id_size),
        4 => Some(1),
        5 => Some(2),
        6 => Some(4),
        7 => Some(8),
        8 => Some(1),
        9 => Some(2),
        10 => Some(4),
        11 => Some(8),
        _ => None,
    }
}

fn compute_class_dump_len(data: &[u8], mut pos: usize, id_size: usize) -> Option<usize> {
    let start = pos;
    pos += id_size * 7 + 8; // skip fixed part
    if pos + 2 > data.len() {
        return None;
    }

    let count1 = get_u16(data, pos);
    pos += 2;
    for _ in 0..count1 {
        if pos + 2 + 1 > data.len() {
            return None;
        }
        let tag = data[pos + 2];
        let len = compute_basic_len(tag, id_size)?;
        pos += 2 + 1 + len;
    }

    if pos + 2 > data.len() {
        return None;
    }
    let count2 = get_u16(data, pos);
    pos += 2;
    for _ in 0..count2 {
        if pos + id_size + 1 > data.len() {
            return None;
        }
        let tag = data[pos + id_size];
        let len = compute_basic_len(tag, id_size)?;
        pos += id_size + 1 + len;
    }

    if pos + 2 > data.len() {
        return None;
    }
    let count3 = get_u16(data, pos);
    pos += 2;
    for _ in 0..count3 {
        pos += id_size + 1;
    }

    Some(pos - start)
}

pub fn normalize_hprof(data: &[u8]) -> Vec<u8> {
    let mut pos = 0;
    while pos < data.len() && data[pos] != 0 {
        pos += 1;
    }
    if pos >= data.len() {
        return data.to_vec();
    }
    let label = std::str::from_utf8(&data[0..pos]).unwrap_or("");
    if label != "JAVA PROFILE 1.0.3" {
        return data.to_vec();
    }

    let mut out = Vec::with_capacity(data.len());
    out.extend_from_slice(b"JAVA PROFILE 1.0.2\0");
    pos += 1;

    if pos + 12 > data.len() {
        return data.to_vec();
    }
    let id_size = get_u32(data, pos) as usize;
    out.extend_from_slice(&data[pos..pos + 12]);
    pos += 12;

    while pos + 9 <= data.len() {
        let tag = data[pos];
        let timestamp = get_u32(data, pos + 1);
        let length = get_u32(data, pos + 5) as usize;
        let record_data = &data[pos + 9..(pos + 9 + length).min(data.len())];

        if tag == 0x0C || tag == 0x1C {
            let mut normalized_record = Vec::with_capacity(length);
            let mut rpos = 0;
            while rpos < record_data.len() {
                let sub_tag = record_data[rpos];
                let sub_len: usize;
                let mut just_copy = true;
                let mut new_sub_tag = sub_tag;

                match sub_tag {
                    0xFF => sub_len = id_size,
                    0x01 => sub_len = id_size * 2,
                    0x02 => sub_len = id_size + 8,
                    0x03 => sub_len = id_size + 8,
                    0x04 => sub_len = id_size + 4,
                    0x05 => sub_len = id_size,
                    0x06 => sub_len = id_size + 4,
                    0x07 => sub_len = id_size,
                    0x08 => sub_len = id_size + 8,
                    0x20 => {
                        if let Some(len) = compute_class_dump_len(record_data, rpos + 1, id_size) {
                            sub_len = len;
                        } else {
                            break;
                        }
                    }
                    0x21 => {
                        if rpos + 1 + id_size * 2 + 8 > record_data.len() {
                            break;
                        }
                        let extra = get_u32(record_data, rpos + 1 + id_size * 2 + 4) as usize;
                        sub_len = id_size * 2 + 8 + extra;
                    }
                    0x22 => {
                        if rpos + 1 + id_size + 8 > record_data.len() {
                            break;
                        }
                        let count = get_u32(record_data, rpos + 1 + id_size + 4) as usize;
                        sub_len = id_size * 2 + 8 + count * id_size;
                    }
                    0x23 => {
                        if rpos + 1 + id_size + 9 > record_data.len() {
                            break;
                        }
                        let count = get_u32(record_data, rpos + 1 + id_size + 4) as usize;
                        let basic_tag = record_data[rpos + 1 + id_size + 8];
                        let basic_len = compute_basic_len(basic_tag, id_size).unwrap_or(0);
                        sub_len = id_size + 9 + count * basic_len;
                    }
                    0xFE => {
                        // HEAP_DUMP_INFO
                        just_copy = false;
                        sub_len = id_size + 4;
                    }
                    0x89 | 0x8A | 0x8B | 0x8C | 0x8D | 0x90 => {
                        new_sub_tag = 0xFF; // ROOT_UNKNOWN
                        sub_len = id_size;
                    }
                    0x8E => {
                        // ROOT_JNI_MONITOR
                        new_sub_tag = 0xFF;
                        just_copy = false;
                        normalized_record.push(0xFF);
                        normalized_record
                            .extend_from_slice(&record_data[rpos + 1..(rpos + 1 + id_size).min(record_data.len())]);
                        sub_len = id_size + 8;
                    }
                    0xC3 => {
                        // PRIMITIVE_ARRAY_NODATA_DUMP
                        new_sub_tag = 0x23;
                        just_copy = false;
                        normalized_record.push(0x23);
                        normalized_record
                            .extend_from_slice(&record_data[rpos + 1..(rpos + 1 + id_size + 4).min(record_data.len())]); // id + stack
                        normalized_record.extend_from_slice(&[0, 0, 0, 0]); // count = 0
                        if rpos + 1 + id_size + 4 + 4 < record_data.len() {
                            normalized_record.push(record_data[rpos + 1 + id_size + 4 + 4]); // basic type
                        }
                        sub_len = id_size + 9;
                    }
                    _ => break,
                }

                if just_copy {
                    normalized_record.push(new_sub_tag);
                    normalized_record.extend_from_slice(
                        &record_data[rpos + 1..(rpos + 1 + sub_len).min(record_data.len())],
                    );
                }
                rpos += 1 + sub_len;
            }

            out.push(tag);
            out.extend_from_slice(&timestamp.to_be_bytes());
            out.extend_from_slice(&(normalized_record.len() as u32).to_be_bytes());
            out.extend_from_slice(&normalized_record);
        } else {
            out.push(tag);
            out.extend_from_slice(&timestamp.to_be_bytes());
            out.extend_from_slice(&(length as u32).to_be_bytes());
            out.extend_from_slice(record_data);
        }
        pos += 9 + length;
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_header() {
        let mut data = b"JAVA PROFILE 1.0.3\0".to_vec();
        data.extend_from_slice(&4u32.to_be_bytes()); // id size
        data.extend_from_slice(&0u64.to_be_bytes()); // timestamp

        let normalized = normalize_hprof(&data);
        assert!(normalized.starts_with(b"JAVA PROFILE 1.0.2\0"));
        assert_eq!(normalized[19..23], 4u32.to_be_bytes());
    }

    #[test]
    fn test_normalize_android_tags() {
        let mut data = b"JAVA PROFILE 1.0.3\0".to_vec();
        data.extend_from_slice(&4u32.to_be_bytes()); // id size
        data.extend_from_slice(&0u64.to_be_bytes()); // timestamp

        // HEAP_DUMP record
        let tag = 0x0C;
        let ts = 100u32;
        let mut record = Vec::new();

        // 0xFE HEAP_DUMP_INFO (should be stripped)
        record.push(0xFE);
        record.extend_from_slice(&[0, 0, 0, 1]); // heap type
        record.extend_from_slice(&[0, 0, 0, 2]); // name string id

        // 0x89 ROOT_INTERNED_STRING (should become 0xFF ROOT_UNKNOWN)
        record.push(0x89);
        record.extend_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF]);

        // 0xC3 PRIMITIVE_ARRAY_NODATA_DUMP (should become 0x23 PRIMITIVE_ARRAY_DUMP with len 0)
        record.push(0xC3);
        record.extend_from_slice(&[0x12, 0x34, 0x56, 0x78]); // obj id
        record.extend_from_slice(&[0, 0, 0, 0]); // stack trace
        record.push(10); // int

        data.push(tag);
        data.extend_from_slice(&ts.to_be_bytes());
        data.extend_from_slice(&(record.len() as u32).to_be_bytes());
        data.extend_from_slice(&record);

        let normalized = normalize_hprof(&data);

        // Skip header
        let rpos = 19 + 12;
        assert_eq!(normalized[rpos], 0x0C);
        let new_len = get_u32(&normalized, rpos + 5) as usize;
        let normalized_record = &normalized[rpos + 9..rpos + 9 + new_len];

        // 0xFE should be gone
        // 0x89 -> 0xFF
        assert_eq!(normalized_record[0], 0xFF);
        assert_eq!(&normalized_record[1..5], &[0xDE, 0xAD, 0xBE, 0xEF]);

        // 0xC3 -> 0x23
        assert_eq!(normalized_record[5], 0x23);
        assert_eq!(&normalized_record[6..10], &[0x12, 0x34, 0x56, 0x78]);
        assert_eq!(&normalized_record[14..18], &[0, 0, 0, 0]); // count 0
        if normalized_record.len() > 18 {
            assert_eq!(normalized_record[18], 10); // int type
        }
    }
}
