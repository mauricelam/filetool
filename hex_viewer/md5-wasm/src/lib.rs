use wasm_bindgen::prelude::*;
use md5;

#[wasm_bindgen]
pub fn compute_md5(data: &[u8]) -> String {
    let digest = md5::compute(data);
    format!("{:x}", digest)
}
