use apple_dmg::DmgReader;
use serde::Serialize;
use tsify::Tsify;
use wasm_bindgen::prelude::*;
use std::io::Cursor;

#[derive(Debug, Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct Partition {
    pub name: String,
    pub cf_name: String,
    pub attributes: String,
    pub id: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct DmgInfo {
    pub partitions: Vec<Partition>,
    /// XML property list text
    pub plist_xml: String,
}

fn partitions_from(plist: &apple_dmg::Plist) -> Vec<Partition> {
    plist
        .partitions()
        .iter()
        .map(|p| Partition {
            name: p.name.clone(),
            cf_name: p.cfname.clone(),
            attributes: p.attributes.clone(),
            id: p.id.clone(),
            data: p.data.clone(),
        })
        .collect()
}

#[wasm_bindgen]
pub fn parse_dmg(dmg_data: &[u8]) -> Result<DmgInfo, JsError> {
    parse_dmg_impl(dmg_data).map_err(JsError::new)
}

pub fn parse_dmg_impl(dmg_data: &[u8]) -> Result<DmgInfo, &'static str> {
    // 1. Try parsing koly trailer at the end of dmg_data if present
    if dmg_data.len() >= 512 {
        let mut koly_cursor = Cursor::new(dmg_data);
        if let Ok(koly) = apple_dmg::KolyTrailer::read_from(&mut koly_cursor) {
            let offset = usize::try_from(koly.plist_offset).ok();
            let len = usize::try_from(koly.plist_length).ok();
            let range = offset
                .zip(len)
                .and_then(|(o, l)| o.checked_add(l).map(|end| (o, end)))
                .filter(|&(_, end)| end <= dmg_data.len());

            if let Some((offset, end)) = range {
                let xml_bytes = &dmg_data[offset..end];
                if let Ok(plist) = plist::from_reader::<_, apple_dmg::Plist>(Cursor::new(xml_bytes)) {
                    let partitions = partitions_from(&plist);
                    let plist_xml = String::from_utf8_lossy(xml_bytes).to_string();
                    return Ok(DmgInfo {
                        partitions,
                        plist_xml,
                    });
                }
            }
        }
    }

    // 2. Try parsing as a full DMG file using DmgReader directly
    let cursor = Cursor::new(dmg_data);
    if let Ok(dmg_reader) = DmgReader::new(cursor) {
        let partitions = partitions_from(dmg_reader.plist());
        let mut xml_bytes = Vec::new();
        if plist::to_writer_xml(&mut xml_bytes, dmg_reader.plist()).is_ok() {
            if let Ok(plist_xml) = String::from_utf8(xml_bytes) {
                return Ok(DmgInfo {
                    partitions,
                    plist_xml,
                });
            }
        }
    }

    // 3. Fallback: Try parsing directly as an XML property list (e.g. extracted XML slice)
    let cursor = Cursor::new(dmg_data);
    if let Ok(plist) = plist::from_reader::<_, apple_dmg::Plist>(cursor) {
        let partitions = partitions_from(&plist);
        let plist_xml = String::from_utf8_lossy(dmg_data).to_string();
        return Ok(DmgInfo {
            partitions,
            plist_xml,
        });
    }

    Err("Failed to parse DMG: data is neither a valid DMG image nor a valid DMG property list")
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINIMAL_PLIST_XML: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>resource-fork</key>
	<dict>
		<key>blkx</key>
		<array>
			<dict>
				<key>Attributes</key>
				<string>0x0050</string>
				<key>CFName</key>
				<string>Minimal Test Partition</string>
				<key>Data</key>
				<data></data>
				<key>ID</key>
				<string>0</string>
				<key>Name</key>
				<string>Minimal Test Partition</string>
			</dict>
		</array>
	</dict>
</dict>
</plist>"#;

    fn make_dmg_with_koly(xml_offset: u64, xml_length: u64, total_size: usize, xml_content: &[u8]) -> Vec<u8> {
        let mut data = vec![0u8; total_size];
        if let (Ok(offset_idx), Ok(_len_idx)) = (usize::try_from(xml_offset), usize::try_from(xml_length)) {
            if let Some(xml_end) = offset_idx.checked_add(xml_content.len()) {
                if offset_idx < total_size && xml_end <= total_size {
                    data[offset_idx..xml_end].copy_from_slice(xml_content);
                }
            }
        }

        if total_size >= 512 {
            let koly_offset = total_size - 512;
            data[koly_offset..koly_offset + 4].copy_from_slice(b"koly");
            data[koly_offset + 4..koly_offset + 8].copy_from_slice(&4u32.to_be_bytes());
            data[koly_offset + 8..koly_offset + 12].copy_from_slice(&512u32.to_be_bytes());
            data[koly_offset + 12..koly_offset + 16].copy_from_slice(&1u32.to_be_bytes());
            data[koly_offset + 216..koly_offset + 224].copy_from_slice(&xml_offset.to_be_bytes());
            data[koly_offset + 224..koly_offset + 232].copy_from_slice(&xml_length.to_be_bytes());
        }
        data
    }

    #[test]
    fn test_minimal_dmg() {
        let xml_bytes = MINIMAL_PLIST_XML.as_bytes();
        let xml_offset: u64 = 1000;
        let xml_length = xml_bytes.len() as u64;
        let total_size = 50000;
        let data = make_dmg_with_koly(xml_offset, xml_length, total_size, xml_bytes);

        // Path 3: Direct XML plist
        let xml_slice = &data[xml_offset as usize..(xml_offset + xml_length) as usize];
        let info = parse_dmg_impl(xml_slice).expect("Failed to parse minimal xml plist via parse_dmg_impl");
        assert_eq!(info.partitions.len(), 1);
        assert_eq!(info.partitions[0].name, "Minimal Test Partition");
        assert!(plist::from_reader::<_, apple_dmg::Plist>(Cursor::new(info.plist_xml.as_bytes())).is_ok());

        // Path 1: Full image with koly trailer
        let full_info = parse_dmg_impl(&data).expect("Failed to parse full minimal DMG image via parse_dmg_impl");
        assert_eq!(full_info.partitions.len(), 1);
        assert_eq!(full_info.partitions[0].name, "Minimal Test Partition");
        assert!(plist::from_reader::<_, apple_dmg::Plist>(Cursor::new(full_info.plist_xml.as_bytes())).is_ok());

        // Test plist re-serialization as used in Path 2
        let plist: apple_dmg::Plist = plist::from_reader(Cursor::new(xml_bytes)).unwrap();
        let mut re_serialized = Vec::new();
        plist::to_writer_xml(&mut re_serialized, &plist).expect("Failed to serialize Plist to XML");
        assert!(plist::from_reader::<_, apple_dmg::Plist>(Cursor::new(&re_serialized)).is_ok());
    }

    #[test]
    fn test_koly_offset_past_eof() {
        let xml_bytes = MINIMAL_PLIST_XML.as_bytes();
        let xml_offset: u64 = 60000; // Past EOF (total_size is 50000)
        let xml_length = xml_bytes.len() as u64;
        let total_size = 50000;
        let data = make_dmg_with_koly(xml_offset, xml_length, total_size, xml_bytes);

        assert!(parse_dmg_impl(&data).is_err());
    }

    #[test]
    fn test_koly_offset_overflow() {
        let xml_bytes = MINIMAL_PLIST_XML.as_bytes();
        let xml_offset: u64 = u64::MAX - 10;
        let xml_length: u64 = 20;
        let total_size = 50000;
        let data = make_dmg_with_koly(xml_offset, xml_length, total_size, xml_bytes);

        assert!(parse_dmg_impl(&data).is_err());
    }

    #[test]
    fn test_koly_trailer_invalid_plist_bytes() {
        let garbage = b"NOT_A_VALID_PLIST_XML_DATA_AT_ALL";
        let xml_offset: u64 = 1000;
        let xml_length = garbage.len() as u64;
        let total_size = 50000;
        let data = make_dmg_with_koly(xml_offset, xml_length, total_size, garbage);

        assert!(parse_dmg_impl(&data).is_err());
    }

    #[test]
    fn test_empty_and_garbage_input() {
        assert!(parse_dmg_impl(&[]).is_err());
        assert!(parse_dmg_impl(b"short garbage").is_err());
        assert!(parse_dmg_impl(&[0u8; 1000]).is_err());
    }
}
