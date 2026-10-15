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
}

#[derive(Debug, Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct DmgInfo {
    pub partitions: Vec<Partition>,
}

#[derive(Debug, Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct KolyInfo {
    pub xml_offset: u64,
    pub xml_length: u64,
}

#[wasm_bindgen]
pub fn parse_koly_header(trailer: &[u8]) -> Result<KolyInfo, JsError> {
    if trailer.len() < 512 {
        return Err(JsError::new("Trailer buffer must be at least 512 bytes"));
    }
    let mut cursor = Cursor::new(trailer);
    let koly = apple_dmg::KolyTrailer::read_from(&mut cursor)
        .map_err(|e| JsError::new(&format!("Failed to parse DMG header: {}", e)))?;

    Ok(KolyInfo {
        xml_offset: koly.plist_offset,
        xml_length: koly.plist_length,
    })
}

#[wasm_bindgen]
pub fn parse_dmg_xml(xml_bytes: &[u8]) -> Result<DmgInfo, JsError> {
    let plist: apple_dmg::Plist = plist::from_reader(Cursor::new(xml_bytes))
        .map_err(|e| JsError::new(&format!("Failed to parse DMG plist: {}", e)))?;

    let partitions = plist
        .partitions()
        .iter()
        .map(|p| Partition {
            name: p.name.clone(),
            cf_name: p.cfname.clone(),
            attributes: p.attributes.clone(),
            id: p.id.clone(),
        })
        .collect();

    Ok(DmgInfo { partitions })
}

#[wasm_bindgen]
pub fn parse_dmg(dmg_data: &[u8]) -> Result<DmgInfo, JsError> {
    let cursor = Cursor::new(dmg_data);
    let dmg_reader = DmgReader::new(cursor).map_err(|e| JsError::new(&format!("Failed to parse DMG: {}", e)))?;

    let partitions = dmg_reader
        .plist()
        .partitions()
        .iter()
        .map(|p| Partition {
            name: p.name.clone(),
            cf_name: p.cfname.clone(),
            attributes: p.attributes.clone(),
            id: p.id.clone(),
        })
        .collect();

    Ok(DmgInfo { partitions })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_googledrive_dmg() {
        if std::path::Path::new("/tmp/GoogleDrive.dmg").exists() {
            let data = std::fs::read("/tmp/GoogleDrive.dmg").unwrap();
            let res = parse_dmg(&data);
            match res {
                Ok(info) => println!("Success: {:?}", info.partitions),
                Err(e) => panic!("Failed: {:?}", e),
            }
        }
    }

    #[test]
    fn test_parse_koly_and_xml() {
        if std::path::Path::new("/tmp/GoogleDrive.dmg").exists() {
            let data = std::fs::read("/tmp/GoogleDrive.dmg").unwrap();
            let koly = parse_koly_header(&data).expect("Failed to parse koly header");
            assert!(koly.xml_offset > 0);
            assert!(koly.xml_length > 0);

            let xml_slice = &data[koly.xml_offset as usize..(koly.xml_offset + koly.xml_length) as usize];
            let info = parse_dmg_xml(xml_slice).expect("Failed to parse xml plist");
            assert_eq!(info.partitions.len(), 4);
        }
    }

    #[test]
    fn test_minimal_dmg() {
        if std::path::Path::new("/tmp/minimal.dmg").exists() {
            let data = std::fs::read("/tmp/minimal.dmg").unwrap();
            let koly = parse_koly_header(&data).expect("Failed to parse minimal koly header");
            assert_eq!(koly.xml_offset, 1000);

            let xml_slice = &data[koly.xml_offset as usize..(koly.xml_offset + koly.xml_length) as usize];
            let info = parse_dmg_xml(xml_slice).expect("Failed to parse minimal xml plist");
            assert_eq!(info.partitions.len(), 1);
            assert_eq!(info.partitions[0].name, "Minimal Test Partition");
        }
    }
}
