use abxml::{
    apk::Apk,
    model::{owned::Entry, Identifier, Library as LibraryTrait},
};
use log::{debug, error, info};
use serde_bytes::ByteBuf;
use std::{collections::HashMap, fs::File, sync::Mutex};
use tsify::Tsify;
use wasm_bindgen::prelude::*;

static SYSTEM_RESOURCES: Mutex<Option<Vec<u8>>> = Mutex::new(None);

#[wasm_bindgen]
pub fn set_system_resources(bytes: Vec<u8>) {
    let mut resources = SYSTEM_RESOURCES.lock().unwrap();
    *resources = Some(bytes);
}

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

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ArscResource {
    package_id: u8,
    type_name: String,
    entry_id: u32,
    name: String,
    value: String,
    entries: Option<HashMap<String, String>>,
}

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ManifestInfo {
    pub package: String,
    pub version_code: Option<String>,
    pub version_name: Option<String>,
    pub min_sdk_version: Option<String>,
    pub target_sdk_version: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct SignerInfo {
    pub sha256_digest: String,
    pub sha1_digest: String,
    pub md5_digest: String,
    pub subject: String,
}

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ApkMetadata {
    pub manifest: Option<ManifestInfo>,
    pub v1_signature: bool,
    pub v2_signature: bool,
    pub v3_signature: bool,
    pub signers: Vec<SignerInfo>,
    pub jar_signatures: Vec<String>,
    pub file_count: usize,
    pub uncompressed_size: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ApkResponse {
    pub files: Vec<(String, ByteBuf)>,
    pub metadata: ApkMetadata,
}

#[wasm_bindgen]
pub fn decode_apk(bytes: Vec<u8>) -> Result<ApkResponse, wasm_bindgen::JsError> {
    info!("Decoding APK of size {} bytes", bytes.len());
    let mut apk = Apk::<File>::from_bytes(&bytes).map_err(|e| {
        error!("Failed to decode APK: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    let resources_lock = SYSTEM_RESOURCES.lock().unwrap();
    let resources = resources_lock
        .as_ref()
        .ok_or_else(|| JsError::new("System resources not set"))?;

    let metadata = apk.get_metadata_with_bytes(&bytes, resources).map_err(|e| {
        error!("Failed to get APK metadata: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    let strings = apk.export_string(resources).map_err(|e| {
        error!("Failed to export strings: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    info!("Successfully decoded APK");

    Ok(ApkResponse {
        files: strings
            .into_iter()
            .map(|(name, contents)| (name, ByteBuf::from(contents)))
            .collect(),
        metadata: ApkMetadata {
            manifest: metadata.manifest.map(|m| ManifestInfo {
                package: m.package,
                version_code: m.version_code,
                version_name: m.version_name,
                min_sdk_version: m.min_sdk_version,
                target_sdk_version: m.target_sdk_version,
            }),
            v1_signature: metadata.v1_signature,
            v2_signature: metadata.v2_signature,
            v3_signature: metadata.v3_signature,
            signers: metadata
                .signers
                .into_iter()
                .map(|s| SignerInfo {
                    sha256_digest: s.sha256_digest,
                    sha1_digest: s.sha1_digest,
                    md5_digest: s.md5_digest,
                    subject: s.subject,
                })
                .collect(),
            jar_signatures: metadata.jar_signatures,
            file_count: metadata.file_count,
            uncompressed_size: metadata.uncompressed_size,
        },
    })
}

#[wasm_bindgen]
pub fn extract_arsc(bytes: Vec<u8>) -> Result<Vec<ArscResource>, wasm_bindgen::JsError> {
    info!("Extracting ARSC of size {} bytes", bytes.len());
    let resources_lock = SYSTEM_RESOURCES.lock().unwrap();
    let resources = resources_lock
        .as_ref()
        .ok_or_else(|| JsError::new("System resources not set"))?;

    let decoder = abxml::decoder::Decoder::from_arsc(resources, &bytes).map_err(|e| {
        error!("Failed to decode ARSC: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    let resources = decoder.get_resources();
    let mut result = Vec::new();

    // Iterate through all packages
    for (package_id, package) in resources.packages.iter() {
        debug!("Processing package {}", package_id);
        if package_id == &1 {
            // Skip processing the Android system package
            continue;
        }

        // Iterate through all type specs
        let type_map: HashMap<u32, String> = package
            .iter_specs()
            .map(|(type_id, _type_spec)| {
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

            let value = entry.to_string(&resources.packages, *package_id);

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
                    Entry::Complex(complex_entry) => {
                        Some(complex_entry.to_hash_map(&resources.packages, *package_id))
                    }
                    _ => None,
                },
            });
        }
    }

    info!("Successfully extracted {} resources", result.len());
    Ok(result)
}

#[wasm_bindgen]
pub fn decode_xml(bytes: Vec<u8>) -> Result<String, wasm_bindgen::JsError> {
    info!("Decoding standalone XML of size {} bytes", bytes.len());

    let resources_lock = SYSTEM_RESOURCES.lock().unwrap();
    let resources = resources_lock
        .as_ref()
        .ok_or_else(|| JsError::new("System resources not set"))?;

    let mut visitor = abxml::visitor::ModelVisitor::default();
    abxml::visitor::Executor::arsc(resources, &mut visitor).map_err(|e| {
        error!("Failed to load system resources: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    let resources = visitor.get_resources();
    let mut xml_visitor = abxml::visitor::XmlVisitor::new(resources);

    abxml::visitor::Executor::xml(std::io::Cursor::new(&bytes), &mut xml_visitor).map_err(|e| {
        error!("Failed to decode XML: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    xml_visitor.into_string().map_err(|e| {
        error!("Failed to convert XML to string: {}", e);
        JsError::new(&format!("{e}"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_arsc() {
        let bytes = include_bytes!("example_resources.arsc").to_vec();
        let decoder = abxml::decoder::Decoder::from_arsc(&bytes, &bytes).unwrap();
        decoder.get_resources();
    }
}
