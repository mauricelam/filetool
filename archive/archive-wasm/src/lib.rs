use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use tsify::Tsify;
use std::io::{Read, Write, Cursor};
use zip::write::FileOptions;
use tar::Builder;
use flate2::write::GzEncoder;
use flate2::Compression;

#[derive(Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ArchiveEntryInfo {
    pub name: String,
    pub size: u64,
    pub is_directory: bool,
}

#[derive(Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ArchiveMetadata {
    pub format: String,
    pub entries: Vec<ArchiveEntryInfo>,
}

#[wasm_bindgen]
pub fn list_entries(data: &[u8]) -> Result<ArchiveMetadata, JsValue> {
    // Try ZIP
    if let Ok(mut zip) = zip::ZipArchive::new(Cursor::new(data)) {
        let mut entries = Vec::new();
        for i in 0..zip.len() {
            if let Ok(file) = zip.by_index(i) {
                entries.push(ArchiveEntryInfo {
                    name: file.name().to_string(),
                    size: file.size(),
                    is_directory: file.is_dir(),
                });
            }
        }
        return Ok(ArchiveMetadata {
            format: "ZIP".to_string(),
            entries,
        });
    }

    // Try 7z
    if let Ok(sevenz) = sevenz_rust2::ArchiveReader::new(Cursor::new(data), sevenz_rust2::Password::empty()) {
        let mut entries = Vec::new();
        for entry in &sevenz.archive().files {
            entries.push(ArchiveEntryInfo {
                name: entry.name().to_string(),
                size: entry.size(),
                is_directory: entry.is_directory(),
            });
        }
        return Ok(ArchiveMetadata {
            format: "7z".to_string(),
            entries,
        });
    }

    // Try CPIO
    let mut entries = Vec::new();
    let mut cursor = Cursor::new(data);
    while let Ok(reader) = cpio::NewcReader::new(cursor) {
        let entry = reader.entry();
        if entry.is_trailer() { break; }
        entries.push(ArchiveEntryInfo {
            name: entry.name().to_string(),
            size: entry.file_size() as u64,
            is_directory: entry.mode() & 0o170000 == 0o040000,
        });
        if let Ok(next_cursor) = reader.finish() {
            cursor = next_cursor;
        } else {
            break;
        }
    }
    if !entries.is_empty() {
        return Ok(ArchiveMetadata {
            format: "CPIO".to_string(),
            entries,
        });
    }

    // Try TAR (including .tar.gz)
    let mut entries = Vec::new();
    let mut format = "TAR".to_string();

    // Try GZIP first
    let mut gz_decoder = flate2::read::GzDecoder::new(Cursor::new(data));
    let mut decompressed = Vec::new();
    if gz_decoder.read_to_end(&mut decompressed).is_ok() {
        format = "TAR.GZ".to_string();
        let mut archive = tar::Archive::new(Cursor::new(&decompressed));
        if let Ok(entries_iter) = archive.entries() {
            for entry in entries_iter {
                if let Ok(file) = entry {
                    entries.push(ArchiveEntryInfo {
                        name: file.path().unwrap().to_string_lossy().to_string(),
                        size: file.size(),
                        is_directory: file.header().entry_type().is_dir(),
                    });
                }
            }
            return Ok(ArchiveMetadata { format, entries });
        }
    }

    // Try plain TAR
    let mut archive = tar::Archive::new(Cursor::new(data));
    if let Ok(entries_iter) = archive.entries() {
        for entry in entries_iter {
            if let Ok(file) = entry {
                entries.push(ArchiveEntryInfo {
                    name: file.path().unwrap().to_string_lossy().to_string(),
                    size: file.size(),
                    is_directory: file.header().entry_type().is_dir(),
                });
            }
        }
        if !entries.is_empty() {
            return Ok(ArchiveMetadata { format, entries });
        }
    }

    Err(JsValue::from_str("Unsupported or invalid archive format"))
}

#[wasm_bindgen]
pub fn extract_entry(data: &[u8], format: &str, entry_name: &str) -> Result<Vec<u8>, JsValue> {
    match format {
        "ZIP" => {
            let mut zip = zip::ZipArchive::new(Cursor::new(data))
                .map_err(|e| JsValue::from_str(&format!("Zip error: {}", e)))?;
            let mut file = zip.by_name(entry_name)
                .map_err(|e| JsValue::from_str(&format!("Zip entry error: {}", e)))?;
            let mut extracted = Vec::new();
            file.read_to_end(&mut extracted)
                .map_err(|e| JsValue::from_str(&format!("Zip extraction error: {}", e)))?;
            Ok(extracted)
        }
        "7z" => {
            let mut sevenz = sevenz_rust2::ArchiveReader::new(Cursor::new(data), sevenz_rust2::Password::empty())
                .map_err(|e| JsValue::from_str(&format!("7z error: {}", e)))?;
            let data = sevenz.read_file(entry_name)
                .map_err(|e| JsValue::from_str(&format!("7z extraction error: {}", e)))?;
            Ok(data)
        }
        "CPIO" => {
            let mut cursor = Cursor::new(data);
            while let Ok(mut reader) = cpio::NewcReader::new(cursor) {
                let entry = reader.entry();
                if entry.is_trailer() { break; }
                if entry.name() == entry_name {
                    let mut extracted = Vec::new();
                    reader.read_to_end(&mut extracted)
                        .map_err(|e| JsValue::from_str(&format!("Cpio extraction error: {}", e)))?;
                    return Ok(extracted);
                }
                if let Ok(next_cursor) = reader.finish() {
                    cursor = next_cursor;
                } else {
                    break;
                }
            }
            Err(JsValue::from_str("Cpio entry not found"))
        }
        "TAR" | "TAR.GZ" => {
            let mut decompressed = Vec::new();
            let mut tar_data: &[u8] = data;
            if format == "TAR.GZ" {
                let mut gz_decoder = flate2::read::GzDecoder::new(Cursor::new(data));
                gz_decoder.read_to_end(&mut decompressed)
                    .map_err(|e| JsValue::from_str(&format!("Gzip error: {}", e)))?;
                tar_data = &decompressed;
            }
            let mut archive = tar::Archive::new(Cursor::new(tar_data));
            if let Ok(entries_iter) = archive.entries() {
                for entry in entries_iter {
                    if let Ok(mut file) = entry {
                        if file.path().unwrap().to_string_lossy() == entry_name {
                            let mut extracted = Vec::new();
                            file.read_to_end(&mut extracted)
                                .map_err(|e| JsValue::from_str(&format!("Tar extraction error: {}", e)))?;
                            return Ok(extracted);
                        }
                    }
                }
            }
            Err(JsValue::from_str("Tar entry not found"))
        }
        _ => Err(JsValue::from_str(&format!("Unsupported format for extraction: {}", format))),
    }
}

#[derive(Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct FileToArchive {
    pub name: String,
    pub data: Vec<u8>,
}

#[derive(Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ZipOptions {
    pub compression_level: Option<i32>, // 0-9
}

#[wasm_bindgen]
pub fn create_zip(files: JsValue, options: JsValue) -> Result<Vec<u8>, JsValue> {
    let files: Vec<FileToArchive> = serde_wasm_bindgen::from_value(files)?;
    let options: ZipOptions = serde_wasm_bindgen::from_value(options)?;

    let mut buf = Vec::new();
    {
        let mut zip = zip::ZipWriter::new(Cursor::new(&mut buf));
        let mut zip_options: FileOptions<'_, ()> = FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        if let Some(level) = options.compression_level {
            zip_options = zip_options.compression_level(Some(level as i64));
        }

        for file in files {
            zip.start_file(file.name, zip_options)
                .map_err(|e| JsValue::from_str(&format!("Zip error: {}", e)))?;
            zip.write_all(&file.data)
                .map_err(|e| JsValue::from_str(&format!("Zip error: {}", e)))?;
        }
        zip.finish().map_err(|e| JsValue::from_str(&format!("Zip error: {}", e)))?;
    }
    Ok(buf)
}

#[derive(Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct TarGzOptions {
    pub compression_level: Option<u32>, // 0-9
}

#[wasm_bindgen]
pub fn create_tar_gz(files: JsValue, options: JsValue) -> Result<Vec<u8>, JsValue> {
    let files: Vec<FileToArchive> = serde_wasm_bindgen::from_value(files)?;
    let options: TarGzOptions = serde_wasm_bindgen::from_value(options)?;

    let mut buf = Vec::new();
    {
        let level = match options.compression_level {
            Some(l) => Compression::new(l),
            None => Compression::default(),
        };
        let enc = GzEncoder::new(Cursor::new(&mut buf), level);
        let mut tar = Builder::new(enc);

        for file in files {
            let mut header = tar::Header::new_gnu();
            header.set_size(file.data.len() as u64);
            header.set_path(&file.name).map_err(|e| JsValue::from_str(&format!("Tar error: {}", e)))?;
            header.set_mode(0o644);
            header.set_cksum();
            tar.append(&header, &file.data[..])
                .map_err(|e| JsValue::from_str(&format!("Tar error: {}", e)))?;
        }
        tar.into_inner().map_err(|e| JsValue::from_str(&format!("Tar error: {}", e)))?
            .finish().map_err(|e| JsValue::from_str(&format!("Gzip error: {}", e)))?;
    }
    Ok(buf)
}
