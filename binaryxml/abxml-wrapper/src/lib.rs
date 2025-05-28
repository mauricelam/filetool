use abxml::{
    apk::Apk,
    model::{owned::Entry, Identifier, Library as LibraryTrait},
};
use log::{debug, error, info};
use serde_bytes::ByteBuf;
use std::{collections::HashMap, fs::File};
use wasm_bindgen::prelude::*;

// Initialize panic hook and logger
fn init() {
    debug!("abxml init");
    console_error_panic_hook::set_once();
    console_log::init_with_level(log::Level::Debug).expect("Failed to initialize logger");
}

#[wasm_bindgen(start)]
pub fn start() {
    init();
    info!("ARSC parser initialized");
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ArscResource {
    package_id: u8,
    type_name: String,
    entry_id: u32,
    name: String,
    value: String,
    entries: Option<HashMap<String, String>>,
}

#[wasm_bindgen]
pub fn decode_apk(bytes: Vec<u8>) -> Result<JsValue, wasm_bindgen::JsError> {
    info!("Decoding APK of size {} bytes", bytes.len());
    let mut apk = Apk::<File>::from_bytes(&bytes).map_err(|e| {
        error!("Failed to decode APK: {}", e);
        JsError::new(&format!("{e}"))
    })?;
    let strings = apk.export_string().map_err(|e| {
        error!("Failed to export strings: {}", e);
        JsError::new(&format!("{e}"))
    })?;
    info!("Successfully decoded APK");
    serde_wasm_bindgen::to_value(
        &strings
            .into_iter()
            .map(|(name, contents)| (name, ByteBuf::from(contents)))
            .collect::<Vec<(String, ByteBuf)>>(),
    )
    .map_err(|e| {
        error!("Failed to serialize result: {}", e);
        JsError::new(&format!("{e}"))
    })
}

#[wasm_bindgen]
pub fn extract_arsc(bytes: Vec<u8>) -> Result<JsValue, wasm_bindgen::JsError> {
    info!("Extracting ARSC of size {} bytes", bytes.len());
    let decoder = abxml::decoder::Decoder::from_arsc(&bytes).map_err(|e| {
        error!("Failed to decode ARSC: {}", e);
        JsError::new(&format!("XX {e}"))
    })?;

    let resources = decoder.get_resources();
    let mut result = Vec::new();

    // Iterate through all packages
    for (package_id, package) in resources.packages.iter() {
        debug!("Processing package {}", package_id);

        // Iterate through all type specs
        let type_map: HashMap<u32, String> = package
            .iter_specs()
            .map(|(type_id, type_spec)| {
                (
                    *type_id,
                    package
                        .get_spec_string(*type_id)
                        .map(|s| s.to_string())
                        .unwrap_or_else(|_| format!("type_{}", type_id)),
                )
            })
            .collect();
        debug!("Type map: {type_map:?}");

        // Get entries for this type
        for (entry_id, entry) in package.iter_entries() {
            let entry_name = package
                .format_reference(*entry_id, entry.get_key(), None)
                .unwrap_or_else(|_| "Unknown".into());

            let value = entry.to_string(package);

            let spec_id = u32::from(entry_id.get_spec());
            let spec_str = package
                .get_spec_as_str(spec_id)
                .unwrap_or_else(|e| format!("{e}"));

            result.push(ArscResource {
                package_id: *package_id,
                type_name: spec_str,
                entry_id: *entry_id,
                name: entry_name,
                value,
                entries: match entry {
                    Entry::Complex(complex_entry) => Some(complex_entry.to_hash_map(package)),
                    _ => None,
                },
            });
        }
    }

    info!("Successfully extracted {} resources", result.len());
    serde_wasm_bindgen::to_value(&result).map_err(|e| {
        error!("Failed to serialize result: {}", e);
        JsError::new(&format!("{e}"))
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_extract_arsc() {
        let bytes = include_bytes!("resources.arsc").to_vec();
        let decoder = abxml::decoder::Decoder::from_arsc(&bytes).unwrap();
        decoder.get_resources();
    }
}
