use wasm_bindgen::prelude::*;
use proguard::{ProguardMapper, ProguardMapping, ProguardRecord};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use serde::{Serialize};

struct MappingData {
    content: String,
    mapping: ProguardMapping<'static>,
}

// This is unsafe, but we need it to store the ProguardMapping in a static variable.
// We are ensuring that the `content` string lives as long as the `mapping`.
unsafe impl Send for MappingData {}

static MAPPING_DATA: Lazy<Mutex<Option<MappingData>>> = Lazy::new(|| Mutex::new(None));

#[wasm_bindgen]
pub fn init_logger() {
    console_log::init_with_level(log::Level::Info).expect("error initializing logger");
}

#[wasm_bindgen]
pub fn parse_map(mapping_file_content: String) -> Result<(), JsValue> {
    log::info!("Parsing map");
    let content = mapping_file_content;
    let mapping = unsafe {
        let static_content: &'static str = std::mem::transmute(content.as_str());
        ProguardMapping::new(static_content.as_bytes())
    };

    let mut guard = MAPPING_DATA.lock().unwrap();
    *guard = Some(MappingData {
        content,
        mapping,
    });
    log::info!("Map parsed successfully");
    Ok(())
}

#[derive(Serialize)]
pub struct SearchResult {
    pub original: String,
    pub obfuscated: String,
}

#[wasm_bindgen]
pub fn search_map(search_term: &str) -> Result<JsValue, JsValue> {
    let guard = MAPPING_DATA.lock().unwrap();
    if let Some(ref mapping_data) = *guard {
        let mut results = Vec::new();
        for record in mapping_data.mapping.iter() {
            if let Ok(ProguardRecord::Class { original, obfuscated }) = record {
                if original.contains(search_term) || obfuscated.contains(search_term) {
                    results.push(SearchResult {
                        original: original.to_string(),
                        obfuscated: obfuscated.to_string(),
                    });
                }
            }
        }
        Ok(serde_wasm_bindgen::to_value(&results)?)
    } else {
        Err(JsValue::from_str("Map not parsed yet"))
    }
}

#[wasm_bindgen]
pub fn deobfuscate(stack_trace: &str) -> Result<String, JsValue> {
    let guard = MAPPING_DATA.lock().unwrap();
    if let Some(ref mapping_data) = *guard {
        let mapper = ProguardMapper::new(mapping_data.mapping.clone());
        let deobfuscated = mapper.remap_stacktrace(stack_trace).unwrap_or_default();
        Ok(deobfuscated)
    } else {
        Err(JsValue::from_str("Map not parsed yet"))
    }
}
