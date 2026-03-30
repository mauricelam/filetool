use wasm_bindgen::prelude::*;
use lzfse_rust::LzfseDecoder;
use flate2::read::{GzDecoder, ZlibDecoder};
use std::io::Read;
use serde::{Serialize, Deserialize};
use tsify::Tsify;

#[derive(Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct DecompressionResult {
    pub data: Vec<u8>,
    pub format: String,
}

#[wasm_bindgen]
pub fn decode(compressed: &[u8]) -> Result<DecompressionResult, JsValue> {
    if compressed.len() < 2 {
        return Err(JsValue::from_str("Input too short"));
    }

    // Try GZIP: 1F 8B
    if compressed.len() >= 4 && compressed[0] == 0x1F && compressed[1] == 0x8B {
        let mut d = GzDecoder::new(compressed);
        let mut decompressed = Vec::new();
        if let Ok(_) = d.read_to_end(&mut decompressed) {
            return Ok(DecompressionResult { data: decompressed, format: "GZIP".to_string() });
        }
    }

    // Try BZIP2: 42 5A 68 (BZh)
    if compressed.starts_with(b"BZh") {
        let mut d = bzip2::read::BzDecoder::new(&compressed[..]);
        let mut decompressed = Vec::new();
        if let Ok(_) = d.read_to_end(&mut decompressed) {
            return Ok(DecompressionResult { data: decompressed, format: "BZIP2".to_string() });
        }
    }

    // Try XZ: FD 37 7A 58 5A 00
    if compressed.starts_with(&[0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00]) {
        let mut decompressed = Vec::new();
        if let Ok(_) = lzma_rs::xz_decompress(&mut &compressed[..], &mut decompressed) {
            return Ok(DecompressionResult { data: decompressed, format: "XZ".to_string() });
        }
    }

    // Try LZMA: 5D 00 00 (common header)
    if compressed.len() >= 3 && compressed[0] == 0x5D && compressed[1] == 0x00 && compressed[2] == 0x00 {
        let mut decompressed = Vec::new();
        if let Ok(_) = lzma_rs::lzma_decompress(&mut &compressed[..], &mut decompressed) {
            return Ok(DecompressionResult { data: decompressed, format: "LZMA".to_string() });
        }
    }

    // Try LZFSE: bvx1, bvx2, bvx-, bvxn
    if compressed.starts_with(b"bvx1") || compressed.starts_with(b"bvx2") || compressed.starts_with(b"bvx-") || compressed.starts_with(b"bvxn") {
        let mut decoder = LzfseDecoder::default();
        let mut decompressed = Vec::new();
        if let Ok(_) = decoder.decode_bytes(compressed, &mut decompressed) {
            if !decompressed.is_empty() {
                return Ok(DecompressionResult { data: decompressed, format: "LZFSE".to_string() });
            }
        }
    }

    // Try ZLIB: 78 01, 78 5E, 78 9C, 78 DA
    if compressed[0] == 0x78 && (compressed[1] == 0x01 || compressed[1] == 0x5E || compressed[1] == 0x9C || compressed[1] == 0xDA) {
        let mut d = ZlibDecoder::new(compressed);
        let mut decompressed = Vec::new();
        if let Ok(_) = d.read_to_end(&mut decompressed) {
            return Ok(DecompressionResult { data: decompressed, format: "ZLIB".to_string() });
        }
    }

    // Brotli fallback: try it if other specific matches fail.
    // Brotli does not have a reliable magic header.
    let mut decompressed = Vec::new();
    if let Ok(_) = brotli::BrotliDecompress(&mut &compressed[..], &mut decompressed) {
        if !decompressed.is_empty() {
            return Ok(DecompressionResult { data: decompressed, format: "Brotli".to_string() });
        }
    }

    // Final catch-all for LZFSE which might have different headers (like LZVN)
    let mut decoder = LzfseDecoder::default();
    let mut decompressed = Vec::new();
    if let Ok(_) = decoder.decode_bytes(compressed, &mut decompressed) {
        if !decompressed.is_empty() {
            return Ok(DecompressionResult { data: decompressed, format: "LZFSE".to_string() });
        }
    }

    Err(JsValue::from_str("Decompression failed: Unknown format or invalid data"))
}
