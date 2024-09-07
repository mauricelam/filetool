use std::fs::File;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn decode_apk(bytes: Vec<u8>) -> Result<JsValue, wasm_bindgen::JsError> {
    let mut apk =
        abxml::apk::Apk::<File>::from_bytes(&bytes).map_err(|e| JsError::new(&format!("{e}")))?;
    let strings = apk
        .export_string()
        .map_err(|e| JsError::new(&format!("{e}")))?;
    serde_wasm_bindgen::to_value(
        &strings
            .into_iter()
            .map(|(name, bytes)| (name, String::from_utf8_lossy(&bytes).into()))
            .collect::<Vec<(String, String)>>(),
    )
    .map_err(|e| JsError::new(&format!("{e}")))
}
