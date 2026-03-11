use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use tsify::Tsify;
use binwalk::Binwalk;

#[derive(Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct BinwalkResult {
    pub offset: usize,
    pub description: String,
    pub length: usize,
}

#[wasm_bindgen]
pub struct BinwalkScanner {
    binwalker: Binwalk,
}

#[wasm_bindgen]
impl BinwalkScanner {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            binwalker: Binwalk::new(),
        }
    }

    pub fn scan(&self, data: &[u8]) -> Result<JsValue, JsValue> {
        let results: Vec<BinwalkResult> = self.binwalker
            .scan(data)
            .into_iter()
            .map(|r| BinwalkResult {
                offset: r.offset,
                description: r.description,
                length: r.size,
            })
            .collect();

        Ok(serde_wasm_bindgen::to_value(&results)?)
    }
}
