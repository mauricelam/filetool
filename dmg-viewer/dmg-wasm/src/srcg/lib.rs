use apple_dmg::Dmg;
use serde::Serialize;
use tsify::Tsify;
use wasm_bindgen::prelude::*;

#[derive(Debug, Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct Partition {
    pub name: String,
    pub description: String,
    pub block_count: u64,
}

#[derive(Debug, Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct DmgInfo {
    pub partitions: Vec<Partition>,
}

#[wasm_bindgen]
pub fn parse_dmg(dmg_data: &[u8]) -> Result<DmgInfo, JsError> {
    let dmg = Dmg::parse(dmg_data).map_err(|e| JsError::new(&format!("Failed to parse DMG: {}", e)))?;

    let partitions = dmg
        .partitions()
        .iter()
        .map(|p| Partition {
            name: p.name().to_string(),
            description: p.description().to_string(),
            block_count: p.block_count(),
        })
        .collect();

    Ok(DmgInfo { partitions })
}
