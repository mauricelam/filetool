use wasm_bindgen::prelude::*;
use cbor_diag::parse_bytes;

#[wasm_bindgen]
pub fn to_diag(s: &str) -> Result<String, String> {
    let s = s.replace("\n", "").replace(" ", "");
    let bytes = hex::decode(s).map_err(|e| e.to_string())?;
    let item = parse_bytes(&bytes).map_err(|e| e.to_string())?;
    Ok(format!("{}", item.to_diag()))
}