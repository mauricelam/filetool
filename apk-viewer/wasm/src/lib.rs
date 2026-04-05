use abxml::{
    apk::Apk,
    model::{
        owned::Entry,
        value::{TOKEN_TYPE_ATTRIBUTE_REFERENCE_ID, TOKEN_TYPE_DYN_ATTRIBUTE, TOKEN_TYPE_DYN_REFERENCE, TOKEN_TYPE_REFERENCE_ID},
        Identifier, Library as LibraryTrait,
    },
};
use log::{debug, error, info};
use serde_bytes::ByteBuf;
use std::{collections::HashMap, fs::File};
use tsify::Tsify;
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

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ArscValue {
    pub value: String,
    pub ref_id: Option<u32>,
}

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ArscConfigValue {
    pub config: String,
    pub value: ArscValue,
    pub entries: Option<Vec<(String, ArscValue)>>,
}

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ArscResource {
    pub package_id: u8,
    pub type_name: String,
    pub entry_id: u32,
    pub name: String,
    pub parent_id: Option<u32>,
    pub parent_name: Option<String>,
    pub values: Vec<ArscConfigValue>,
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
    pub compressed_size: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Tsify, Clone)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct SizeBreakdown {
    pub name: String,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    pub group: Option<String>,
    pub children: Option<Vec<SizeBreakdown>>,
}

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ApkResponse {
    pub files: Vec<(String, ByteBuf)>,
    pub metadata: ApkMetadata,
}

#[wasm_bindgen]
pub fn decode_apk(
    bytes: Vec<u8>,
    system_resources: Vec<u8>,
) -> Result<ApkResponse, wasm_bindgen::JsError> {
    info!("Decoding APK of size {} bytes", bytes.len());
    let mut apk = Apk::<File>::from_bytes(&bytes).map_err(|e| {
        error!("Failed to decode APK: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    let metadata = apk
        .get_metadata_with_bytes(&bytes, &system_resources)
        .map_err(|e| {
            error!("Failed to get APK metadata: {}", e);
            JsError::new(&format!("{e}"))
        })?;

    let strings = apk.export_string(&system_resources).map_err(|e| {
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
            compressed_size: bytes.len() as u64,
        },
    })
}

#[derive(serde::Serialize, serde::Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ApkMinimalResponse {
    pub metadata: ApkMetadata,
    pub file_names: Vec<String>,
}

#[wasm_bindgen]
pub fn decode_apk_minimal(
    bytes: Vec<u8>,
    system_resources: Vec<u8>,
) -> Result<ApkMinimalResponse, wasm_bindgen::JsError> {
    info!("Decoding APK minimal of size {} bytes", bytes.len());
    let mut apk = Apk::<File>::from_bytes(&bytes).map_err(|e| {
        error!("Failed to decode APK: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    let metadata = apk
        .get_metadata_with_bytes(&bytes, &system_resources)
        .map_err(|e| {
            error!("Failed to get APK metadata: {}", e);
            JsError::new(&format!("{e}"))
        })?;

    let file_names = apk.get_file_names();

    Ok(ApkMinimalResponse {
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
            compressed_size: bytes.len() as u64,
        },
        file_names,
    })
}

#[wasm_bindgen]
pub fn extract_file(
    bytes: Vec<u8>,
    name: String,
    system_resources: Vec<u8>,
) -> Result<Vec<u8>, wasm_bindgen::JsError> {
    let mut apk = Apk::<File>::from_bytes(&bytes).map_err(|e| {
        error!("Failed to decode APK: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    let contents = apk.extract_file(&name, &system_resources).map_err(|e| {
        error!("Failed to extract file: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    Ok(contents)
}

#[wasm_bindgen]
pub fn extract_arsc(
    bytes: Vec<u8>,
    system_resources: Vec<u8>,
) -> Result<Vec<ArscResource>, wasm_bindgen::JsError> {
    info!("Extracting ARSC of size {} bytes", bytes.len());
    let decoder = abxml::decoder::Decoder::from_arsc(&system_resources, &bytes).map_err(|e| {
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
        for (entry_id, all_entries) in package.iter_entries() {
            let entry_name = if let Some((_, first_entry)) = all_entries.first() {
                package
                    .format_reference(*entry_id, first_entry.get_key(), None)
                    .unwrap_or_else(|_| "Unknown".into())
            } else {
                "Unknown".into()
            };

            let spec_id = u32::from(entry_id.get_spec());
            let spec_str = package
                .get_spec_as_str(spec_id)
                .unwrap_or_else(|e| format!("{e}"));

            let mut values = Vec::new();
            let mut parent_id = None;

            for (config, entry) in all_entries {
                let value_str = entry.to_string(&resources.packages, *package_id);

                let ref_id = match entry {
                    Entry::Simple(simple_entry) => {
                        let value_type = simple_entry.get_type();
                        if value_type == TOKEN_TYPE_REFERENCE_ID
                            || value_type == TOKEN_TYPE_ATTRIBUTE_REFERENCE_ID
                            || value_type == TOKEN_TYPE_DYN_REFERENCE
                            || value_type == TOKEN_TYPE_DYN_ATTRIBUTE
                        {
                            Some(simple_entry.get_value_data())
                        } else {
                            None
                        }
                    }
                    _ => None,
                };

                if parent_id.is_none() {
                    parent_id = match entry {
                        Entry::Complex(complex_entry) => {
                            let pid = complex_entry.get_parent_id();
                            if pid == 0 {
                                None
                            } else {
                                Some(pid)
                            }
                        }
                        _ => None,
                    };
                }

                let entries = match entry {
                    Entry::Complex(complex_entry) => {
                        let mut complex_entries = Vec::new();
                        for e in complex_entry.get_entries() {
                            let name = if e.get_id() == 0x1000000 {
                                "type".into()
                            } else {
                                let package_id_entry = e.get_id().get_package();
                                let package_entry = resources.packages.get(&package_id_entry).unwrap();
                                package_entry.resid_to_string(
                                    e.get_id(),
                                    if package_id_entry == 1 {
                                        Some("android".into())
                                    } else {
                                        None
                                    },
                                )
                            };

                            let val_str = e.to_string(&resources.packages, *package_id);
                            let val_type = e.get_type();
                            let val_ref_id = if val_type == TOKEN_TYPE_REFERENCE_ID
                                || val_type == TOKEN_TYPE_ATTRIBUTE_REFERENCE_ID
                                || val_type == TOKEN_TYPE_DYN_REFERENCE
                                || val_type == TOKEN_TYPE_DYN_ATTRIBUTE
                            {
                                Some(e.get_value_data())
                            } else {
                                None
                            };

                            complex_entries.push((
                                name,
                                ArscValue {
                                    value: val_str,
                                    ref_id: val_ref_id,
                                },
                            ));
                        }
                        Some(complex_entries)
                    }
                    _ => None,
                };

                values.push(ArscConfigValue {
                    config: config.clone(),
                    value: ArscValue {
                        value: value_str,
                        ref_id,
                    },
                    entries,
                });
            }

            let parent_name = parent_id.and_then(|pid| {
                let pid_package = pid.get_package();
                resources.packages.get(&pid_package).map(|p| p.resid_to_string(pid, None))
            });

            result.push(ArscResource {
                package_id: *package_id,
                type_name: spec_str,
                entry_id: *entry_id,
                name: entry_name,
                parent_id,
                parent_name,
                values,
            });
        }
    }

    info!("Successfully extracted {} resources", result.len());
    Ok(result)
}

#[wasm_bindgen]
pub fn analyze_apk_size(
    bytes: Vec<u8>,
    system_resources: Vec<u8>,
) -> Result<SizeBreakdown, wasm_bindgen::JsError> {
    info!("Analyzing APK size of {} bytes", bytes.len());
    let mut apk = Apk::<std::io::Cursor<&[u8]>>::from_bytes(&bytes).map_err(|e| {
        error!("Failed to decode APK: {}", e);
        JsError::new(&format!("{e}"))
    })?;

    let files = apk.get_files_info();

    let mut code_files = Vec::new();
    let mut lib_files = Vec::new();
    let mut resource_files = Vec::new();
    let mut asset_files = Vec::new();
    let mut other_files = Vec::new();

    for file in files {
        if file.name.ends_with(".dex") {
            code_files.push(file);
        } else if file.name.starts_with("lib/") {
            lib_files.push(file);
        } else if file.name.starts_with("res/") || file.name == "resources.arsc" {
            resource_files.push(file);
        } else if file.name.starts_with("assets/") {
            asset_files.push(file);
        } else {
            other_files.push(file);
        }
    }

    // 1. Code Breakdown (DEX)
    let mut code_children = Vec::new();
    let mut all_packages_map: HashMap<String, (u64, Vec<SizeBreakdown>)> = HashMap::new();
    let mut all_dex_total_uncompressed = 0;
    let mut all_dex_total_compressed = 0;
    let mut total_overhead = 0;

    for file in &code_files {
        let content = apk.extract_file(&file.name, &system_resources).map_err(|e| {
            error!("Failed to extract {}: {}", file.name, e);
            JsError::new(&format!("{e}"))
        })?;

        let dex = dex::DexReader::from_vec(&content).map_err(|e| {
            error!("Failed to parse DEX {}: {:?}", file.name, e);
            JsError::new(&format!("Failed to parse DEX {}: {:?}", file.name, e))
        })?;

        let mut package_map: HashMap<String, (u64, Vec<SizeBreakdown>)> = HashMap::new();
        let mut total_class_size = 0;

        use dex::scroll::Pread;
        let endian = dex.get_endian();
        for class_def in dex.class_defs() {
            if let Ok(class_def) = class_def {
                let mut class_size = 0;

                if let Ok(Some(class_data)) = dex.get_class_data(class_def.class_data_off()) {
                    if let Some(direct_methods) = class_data.direct_methods() {
                        for method in direct_methods.iter() {
                            let off = *method.code_offset() as usize;
                            if off != 0 && off + 16 <= content.len() {
                                if let Ok(insns_size) = content.pread_with::<u32>(off + 12, endian) {
                                    class_size += (insns_size * 2) as u64;
                                }
                            }
                        }
                    }
                    if let Some(virtual_methods) = class_data.virtual_methods() {
                        for method in virtual_methods.iter() {
                            let off = *method.code_offset() as usize;
                            if off != 0 && off + 16 <= content.len() {
                                if let Ok(insns_size) = content.pread_with::<u32>(off + 12, endian) {
                                    class_size += (insns_size * 2) as u64;
                                }
                            }
                        }
                    }
                }

                class_size += 32;
                total_class_size += class_size;

                let jtype = dex.get_type(class_def.class_idx()).map(|t| t.to_string()).unwrap_or_default();
                let full_name = jtype;
                let (package, name) = if let Some(last_slash) = full_name.rfind('/') {
                    (full_name[1..last_slash].replace('/', "."), &full_name[last_slash + 1..full_name.len() - 1])
                } else {
                    ("".to_string(), &full_name[1..full_name.len() - 1])
                };

                let entry = package_map.entry(package.clone()).or_insert((0, Vec::new()));
                entry.0 += class_size;
                let class_node = SizeBreakdown {
                    name: name.to_string(),
                    compressed_size: 0, // We don't have per-class compressed size
                    uncompressed_size: class_size,
                    group: None,
                    children: None,
                };
                entry.1.push(class_node.clone());

                let all_entry = all_packages_map.entry(package).or_insert((0, Vec::new()));
                all_entry.0 += class_size;
                all_entry.1.push(class_node);
            }
        }

        let mut dex_children = Vec::new();
        // Add Shared/Overhead
        let overhead = file.uncompressed_size.saturating_sub(total_class_size);
        total_overhead += overhead;
        dex_children.push(SizeBreakdown {
            name: "[Shared/Overhead]".to_string(),
            compressed_size: 0,
            uncompressed_size: overhead,
            group: None,
            children: None,
        });

        for (pkg_name, (pkg_size, classes)) in package_map {
            dex_children.push(SizeBreakdown {
                name: pkg_name,
                compressed_size: 0,
                uncompressed_size: pkg_size,
                group: None,
                children: Some(classes),
            });
        }

        all_dex_total_uncompressed += file.uncompressed_size;
        all_dex_total_compressed += file.compressed_size;

        code_children.push(SizeBreakdown {
            name: file.name.clone(),
            compressed_size: file.compressed_size,
            uncompressed_size: file.uncompressed_size,
            group: None,
            children: Some(dex_children),
        });
    }

    let mut combined_code_children = Vec::new();
    combined_code_children.push(SizeBreakdown {
        name: "[Shared/Overhead]".to_string(),
        compressed_size: 0,
        uncompressed_size: total_overhead,
        group: None,
        children: None,
    });
    for (pkg_name, (pkg_size, classes)) in all_packages_map {
        combined_code_children.push(SizeBreakdown {
            name: pkg_name,
            compressed_size: 0,
            uncompressed_size: pkg_size,
            group: None,
            children: Some(classes),
        });
    }

    let mut code_top_level = Vec::new();
    code_top_level.push(SizeBreakdown {
        name: "Group by DEX".to_string(),
        compressed_size: all_dex_total_compressed,
        uncompressed_size: all_dex_total_uncompressed,
        group: None,
        children: Some(code_children.clone()),
    });
    code_top_level.push(SizeBreakdown {
        name: "All Packages".to_string(),
        compressed_size: all_dex_total_compressed,
        uncompressed_size: all_dex_total_uncompressed,
        group: None,
        children: Some(combined_code_children),
    });

    // 2. Lib Breakdown (Architecture)
    let mut lib_children: Vec<SizeBreakdown> = Vec::new();
    for file in lib_files {
        let parts: Vec<&str> = file.name.split('/').collect();
        let arch = if parts.len() >= 2 { parts[1] } else { "unknown" };
        lib_children.push(SizeBreakdown {
            name: format!("{}:{}", arch, parts.last().unwrap_or(&file.name.as_str())),
            compressed_size: file.compressed_size,
            uncompressed_size: file.uncompressed_size,
            group: Some(arch.to_string()),
            children: None,
        });
    }

    // 3. Resource Breakdown (Type)
    let mut res_type_map: HashMap<String, (u64, u64, Vec<SizeBreakdown>)> = HashMap::new();
    for file in resource_files {
        if file.name == "resources.arsc" {
            // Further breakdown for resources.arsc
            if let Ok(content) = apk.extract_file(&file.name, &system_resources) {
                if let Ok(decoder) = abxml::decoder::Decoder::from_arsc(&system_resources, &content) {
                    let mut arsc_type_map: HashMap<String, u64> = HashMap::new();
                    let resources = decoder.get_resources();
                    for (_package_id, package) in resources.packages.iter() {
                        for (entry_id, all_entries) in package.iter_entries() {
                            let spec_id = u32::from(entry_id.get_spec());
                            let type_name = package.get_spec_as_str(spec_id)
                                .unwrap_or_else(|_| format!("type_{}", spec_id));

                            let mut entry_size = 0;
                            for (_, entry) in all_entries {
                                entry_size += match entry {
                                    Entry::Simple(_) => 16,
                                    Entry::Complex(c) => 16 + (c.get_entries().len() * 12) as u64,
                                    Entry::Empty(_, _) => 0,
                                };
                            }
                            *arsc_type_map.entry(type_name).or_insert(0) += entry_size;
                        }
                    }
                    let total_arsc_weight: u64 = arsc_type_map.values().sum();
                    let arsc_children: Vec<SizeBreakdown> = arsc_type_map.into_iter().map(|(t, w)| {
                        let ratio = if total_arsc_weight > 0 { w as f64 / total_arsc_weight as f64 } else { 0.0 };
                        SizeBreakdown {
                            name: t,
                            compressed_size: (file.compressed_size as f64 * ratio) as u64,
                            uncompressed_size: (file.uncompressed_size as f64 * ratio) as u64,
                            group: None,
                            children: None,
                        }
                    }).collect();

                    let entry = res_type_map.entry("ARSC".to_string()).or_insert((0, 0, Vec::new()));
                    entry.0 += file.compressed_size;
                    entry.1 += file.uncompressed_size;
                    entry.2.extend(arsc_children);
                    continue;
                }
            }
        }

        let res_type = if file.name.starts_with("res/") {
            let parts: Vec<&str> = file.name.split('/').collect();
            if parts.len() >= 2 {
                parts[1].split('-').next().unwrap_or("unknown")
            } else {
                "unknown"
            }
        } else {
            "unknown"
        };
        let entry = res_type_map.entry(res_type.to_string()).or_insert((0, 0, Vec::new()));
        entry.0 += file.compressed_size;
        entry.1 += file.uncompressed_size;
        entry.2.push(SizeBreakdown {
            name: file.name,
            compressed_size: file.compressed_size,
            uncompressed_size: file.uncompressed_size,
            group: None,
            children: None,
        });
    }
    let res_children: Vec<SizeBreakdown> = res_type_map
        .into_iter()
        .map(|(t, (c, u, children))| SizeBreakdown {
            name: t.to_string(),
            compressed_size: c,
            uncompressed_size: u,
            group: None,
            children: Some(children),
        })
        .collect();

    // 4. Assets Breakdown (Hierarchy)
    // A simpler way for assets: just group by first level of assets/
    let mut asset_map: HashMap<String, (u64, u64, Vec<SizeBreakdown>)> = HashMap::new();
    for file in asset_files {
        let parts: Vec<&str> = file.name.split('/').collect();
        let top = if parts.len() >= 2 { parts[1] } else { "root" };
        let entry = asset_map.entry(top.to_string()).or_insert((0, 0, Vec::new()));
        entry.0 += file.compressed_size;
        entry.1 += file.uncompressed_size;
        entry.2.push(SizeBreakdown {
            name: file.name,
            compressed_size: file.compressed_size,
            uncompressed_size: file.uncompressed_size,
            group: None,
            children: None,
        });
    }
    let asset_children: Vec<SizeBreakdown> = asset_map
        .into_iter()
        .map(|(top, (c, u, children))| SizeBreakdown {
            name: top,
            compressed_size: c,
            uncompressed_size: u,
            group: None,
            children: Some(children),
        })
        .collect();

    let root = SizeBreakdown {
        name: "APK".to_string(),
        compressed_size: bytes.len() as u64,
        uncompressed_size: code_children.iter().map(|c| c.uncompressed_size).sum::<u64>()
            + lib_children.iter().map(|c| c.uncompressed_size).sum::<u64>()
            + res_children.iter().map(|c| c.uncompressed_size).sum::<u64>()
            + asset_children.iter().map(|c| c.uncompressed_size).sum::<u64>()
            + other_files.iter().map(|c| c.uncompressed_size).sum::<u64>(),
        group: None,
        children: Some(vec![
            SizeBreakdown {
                name: "Code".to_string(),
                compressed_size: all_dex_total_compressed,
                uncompressed_size: all_dex_total_uncompressed,
                group: None,
                children: Some(code_top_level),
            },
            SizeBreakdown {
                name: "Lib".to_string(),
                compressed_size: lib_children.iter().map(|c| c.compressed_size).sum(),
                uncompressed_size: lib_children.iter().map(|c| c.uncompressed_size).sum(),
                group: None,
                children: Some(lib_children),
            },
            SizeBreakdown {
                name: "Resources".to_string(),
                compressed_size: res_children.iter().map(|c| c.compressed_size).sum(),
                uncompressed_size: res_children.iter().map(|c| c.uncompressed_size).sum(),
                group: None,
                children: Some(res_children),
            },
            SizeBreakdown {
                name: "Assets".to_string(),
                compressed_size: asset_children.iter().map(|c| c.compressed_size).sum(),
                uncompressed_size: asset_children.iter().map(|c| c.uncompressed_size).sum(),
                group: None,
                children: Some(asset_children),
            },
            SizeBreakdown {
                name: "Other".to_string(),
                compressed_size: other_files.iter().map(|c| c.compressed_size).sum(),
                uncompressed_size: other_files.iter().map(|c| c.uncompressed_size).sum(),
                group: None,
                children: Some(
                    other_files
                        .into_iter()
                        .map(|f| SizeBreakdown {
                            name: f.name,
                            compressed_size: f.compressed_size,
                            uncompressed_size: f.uncompressed_size,
                            group: None,
                            children: None,
                        })
                        .collect(),
                ),
            },
        ]),
    };

    Ok(root)
}

#[wasm_bindgen]
pub fn decode_xml(bytes: Vec<u8>, system_resources: Vec<u8>) -> Result<String, wasm_bindgen::JsError> {
    info!("Decoding standalone XML of size {} bytes", bytes.len());

    let mut visitor = abxml::visitor::ModelVisitor::default();
    abxml::visitor::Executor::arsc(&system_resources, &mut visitor).map_err(|e| {
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
