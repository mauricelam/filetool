use wasm_bindgen::prelude::*;
use binwalk::Binwalk;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct WasmSignatureResult {
    pub offset: usize,
    pub description: String,
    pub name: String,
    pub confidence: u8,
}

#[wasm_bindgen]
pub fn scan(data: &[u8]) -> Result<JsValue, JsValue> {
    let binwalker = Binwalk::new();
    let results: Vec<WasmSignatureResult> = binwalker.scan(data)
        .into_iter()
        .map(|r| WasmSignatureResult {
            offset: r.offset,
            description: r.description,
            name: r.name,
            confidence: r.confidence,
        })
        .collect();

    Ok(serde_wasm_bindgen::to_value(&results)?)
}
