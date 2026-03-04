use wasm_bindgen::prelude::*;
use abxml_wasm_common::*;

#[wasm_bindgen(start)]
pub fn start() {
    common_init();
}

#[wasm_bindgen]
pub fn decode_xml(bytes: Vec<u8>) -> Result<String, wasm_bindgen::JsError> {
    common_decode_xml(bytes).map_err(|e| wasm_bindgen::JsError::new(&format!("{e}")))
}

#[wasm_bindgen]
pub fn extract_arsc(bytes: Vec<u8>) -> Result<Vec<ArscResource>, wasm_bindgen::JsError> {
    common_extract_arsc(bytes).map_err(|e| wasm_bindgen::JsError::new(&format!("{e}")))
}
