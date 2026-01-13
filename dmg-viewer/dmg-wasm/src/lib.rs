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
