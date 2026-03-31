use wasm_bindgen::prelude::*;
use md5;
use serde::{Serialize, Deserialize};
use binwalk::Binwalk;

#[wasm_bindgen]
pub fn compute_md5(data: &[u8]) -> String {
    let digest = md5::compute(data);
    format!("{:x}", digest)
}

#[derive(Serialize, Deserialize)]
pub struct BinwalkResult {
    pub offset: usize,
    pub description: String,
    pub length: usize,
    pub confidence: u8,
}

#[wasm_bindgen]
pub struct BinwalkScanner {
    binwalker: Binwalk,
}

#[wasm_bindgen]
impl BinwalkScanner {
    #[wasm_bindgen(constructor)]
    pub fn new(full_search: bool) -> Result<BinwalkScanner, JsValue> {
        let binwalker = Binwalk::configure(None, None, None, None, None, full_search)
            .map_err(|e| JsValue::from_str(&e.message))?;
        Ok(Self {
            binwalker,
        })
    }

    pub fn scan(&self, data: &[u8]) -> Result<JsValue, JsValue> {
        let results: Vec<BinwalkResult> = self.binwalker
            .scan(data)
            .into_iter()
            .map(|r| BinwalkResult {
                offset: r.offset,
                description: r.description,
                length: r.size,
                confidence: r.confidence,
            })
            .collect();

        Ok(serde_wasm_bindgen::to_value(&results)?)
    }
}
