use wasm_bindgen::prelude::*;
use lzfse_rust::LzfseDecoder;
use flate2::read::{GzDecoder, ZlibDecoder};
use std::io::Read;

#[wasm_bindgen]
pub fn decode(compressed: &[u8]) -> Result<Vec<u8>, JsValue> {
    // Try LZFSE first (original behavior)
    let mut decoder = LzfseDecoder::default();
    let mut decompressed = Vec::new();

    if let Ok(_) = decoder.decode_bytes(compressed, &mut decompressed) {
        if !decompressed.is_empty() {
             return Ok(decompressed);
        }
    }

    // Try GZIP
    let mut d = GzDecoder::new(compressed);
    let mut decompressed = Vec::new();
    if let Ok(_) = d.read_to_end(&mut decompressed) {
        return Ok(decompressed);
    }

    // Try ZLIB
    let mut d = ZlibDecoder::new(compressed);
    let mut decompressed = Vec::new();
    if let Ok(_) = d.read_to_end(&mut decompressed) {
        return Ok(decompressed);
    }

    // Try LZMA
    let mut decompressed = Vec::new();
    if let Ok(_) = lzma_rs::lzma_decompress(&mut &compressed[..], &mut decompressed) {
        return Ok(decompressed);
    }

    // Try XZ
    let mut decompressed = Vec::new();
    if let Ok(_) = lzma_rs::xz_decompress(&mut &compressed[..], &mut decompressed) {
        return Ok(decompressed);
    }

    // Try Brotli
    let mut decompressed = Vec::new();
    let mut d = brotli::Decompressor::new(compressed, 4096);
    if let Ok(_) = d.read_to_end(&mut decompressed) {
        return Ok(decompressed);
    }

    Err(JsValue::from_str("Decompression failed: Unknown format or invalid data"))
}
