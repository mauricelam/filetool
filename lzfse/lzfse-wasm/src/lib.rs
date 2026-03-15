use wasm_bindgen::prelude::*;
use lzfse_rust::LzfseDecoder;

#[wasm_bindgen]
pub fn decode(compressed: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut decoder = LzfseDecoder::default();
    let mut decompressed = Vec::new();

    match decoder.decode_bytes(compressed, &mut decompressed) {
        Ok(_) => Ok(decompressed),
        Err(e) => Err(JsValue::from_str(&format!("Decompression failed: {}", e))),
    }
}
