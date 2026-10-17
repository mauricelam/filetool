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
    pub plist_xml: String,
}

#[wasm_bindgen]
pub fn parse_dmg(dmg_data: &[u8]) -> Result<DmgInfo, JsError> {
    // 1. Try parsing koly trailer at the end of dmg_data if present
    if dmg_data.len() >= 512 {
        let mut koly_cursor = Cursor::new(dmg_data);
        if let Ok(koly) = apple_dmg::KolyTrailer::read_from(&mut koly_cursor) {
            let offset = koly.plist_offset as usize;
            let len = koly.plist_length as usize;
            if offset + len <= dmg_data.len() {
                let xml_bytes = &dmg_data[offset..offset + len];
                if let Ok(plist) = plist::from_reader::<_, apple_dmg::Plist>(Cursor::new(xml_bytes)) {
                    let partitions = plist
                        .partitions()
                        .iter()
                        .map(|p| Partition {
                            name: p.name.clone(),
                            cf_name: p.cfname.clone(),
                            attributes: p.attributes.clone(),
                            id: p.id.clone(),
                            data: p.data.clone(),
                        })
                        .collect();

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
        let partitions = dmg_reader
            .plist()
            .partitions()
            .iter()
            .map(|p| Partition {
                name: p.name.clone(),
                cf_name: p.cfname.clone(),
                attributes: p.attributes.clone(),
                id: p.id.clone(),
                data: p.data.clone(),
            })
            .collect();

        let plist_xml = format!("{:?}", dmg_reader.plist());
        return Ok(DmgInfo {
            partitions,
            plist_xml,
        });
    }

    // 3. Fallback: Try parsing directly as an XML property list (e.g. extracted XML slice)
    let cursor = Cursor::new(dmg_data);
    if let Ok(plist) = plist::from_reader::<_, apple_dmg::Plist>(cursor) {
        let partitions = plist
            .partitions()
            .iter()
            .map(|p| Partition {
                name: p.name.clone(),
                cf_name: p.cfname.clone(),
                attributes: p.attributes.clone(),
                id: p.id.clone(),
                data: p.data.clone(),
            })
            .collect();

        let plist_xml = String::from_utf8_lossy(dmg_data).to_string();
        return Ok(DmgInfo {
            partitions,
            plist_xml,
        });
    }

    Err(JsError::new("Failed to parse DMG: data is neither a valid DMG image nor a valid DMG property list"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minimal_dmg() {
        let xml_bytes = r#"<?xml version="1.0" encoding="UTF-8"?>
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
</plist>"#.as_bytes();

        let xml_offset: u64 = 1000;
        let xml_length = xml_bytes.len() as u64;
        let total_size = 50000;
        let mut data = vec![0u8; total_size];

        data[xml_offset as usize..xml_offset as usize + xml_bytes.len()].copy_from_slice(xml_bytes);

        let koly_offset = total_size - 512;
        data[koly_offset..koly_offset + 4].copy_from_slice(b"koly");
        data[koly_offset + 4..koly_offset + 8].copy_from_slice(&4u32.to_be_bytes());
        data[koly_offset + 8..koly_offset + 12].copy_from_slice(&512u32.to_be_bytes());
        data[koly_offset + 12..koly_offset + 16].copy_from_slice(&1u32.to_be_bytes());
        data[koly_offset + 216..koly_offset + 224].copy_from_slice(&xml_offset.to_be_bytes());
        data[koly_offset + 224..koly_offset + 232].copy_from_slice(&xml_length.to_be_bytes());

        let xml_slice = &data[xml_offset as usize..(xml_offset + xml_length) as usize];
        let info = parse_dmg(xml_slice).expect("Failed to parse minimal xml plist via parse_dmg");
        assert_eq!(info.partitions.len(), 1);
        assert_eq!(info.partitions[0].name, "Minimal Test Partition");

        // Test parse_dmg on full image data (which parses koly header internally)
        let full_info = parse_dmg(&data).expect("Failed to parse full minimal DMG image via parse_dmg");
        assert_eq!(full_info.partitions.len(), 1);
        assert_eq!(full_info.partitions[0].name, "Minimal Test Partition");
    }
}
