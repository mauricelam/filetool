use wasm_bindgen::prelude::*;
use cbor_diag::parse_bytes;

#[wasm_bindgen]
pub fn to_diag(bytes: &[u8]) -> Result<String, String> {
    let item = parse_bytes(&bytes).map_err(|e| e.to_string())?;
    Ok(item.to_diag())
}