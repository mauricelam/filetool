//! WASM backend for the ext4 viewer, using the `ext4-view` crate.
//!
//! This module provides functions to parse an ext4 image and extract its file tree
//! and individual file contents.

use std::collections::BTreeMap;
use std::io::{Read, Seek, SeekFrom};
use serde::Serialize;
use tsify::Tsify;
use wasm_bindgen::prelude::*;
use ext4_view::Ext4;

/// Custom block reader that bridges `ext4-view` with JavaScript's range-based `file.slice()`.
///
/// Implements `ext4_view::Ext4Read` by calling a JS callback (`read_fn`) passed from
/// `img-viewer/main.tsx` (`parse_ext4_stream` / `read_ext4_file_stream`).
/// In Web Workers, `read_fn` uses `FileReaderSync.readAsArrayBuffer(file.slice(offset, offset + length))`
/// to fetch requested disk blocks synchronously on demand without buffering the entire image in memory.
struct JsReader {
    func: js_sys::Function,
    pos: u64,
    size: u64,
}

impl Read for JsReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if self.pos >= self.size {
            return Ok(0);
        }
        let to_read = (buf.len() as u64).min(self.size - self.pos) as usize;
        if to_read == 0 {
            return Ok(0);
        }
        let this = JsValue::NULL;
        let arg_offset = JsValue::from_f64(self.pos as f64);
        let arg_len = JsValue::from_f64(to_read as f64);
        if let Ok(res) = self.func.call2(&this, &arg_offset, &arg_len) {
            let uint8 = js_sys::Uint8Array::new(&res);
            let len = uint8.length() as usize;
            uint8.copy_to(&mut buf[..len]);
            self.pos += len as u64;
            Ok(len)
        } else {
            Err(std::io::Error::new(std::io::ErrorKind::Other, "JS read failed"))
        }
    }
}

impl Seek for JsReader {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        let new_pos = match pos {
            SeekFrom::Start(n) => n as i64,
            SeekFrom::End(n) => self.size as i64 + n,
            SeekFrom::Current(n) => self.pos as i64 + n,
        };
        if new_pos < 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "invalid seek to negative position",
            ));
        }
        self.pos = new_pos as u64;
        Ok(self.pos)
    }
}

impl ext4_view::Ext4Read for JsReader {
    fn read(&mut self, offset: u64, buf: &mut [u8]) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if offset >= self.size {
            return Ok(());
        }
        let to_read = (buf.len() as u64).min(self.size - offset) as usize;
        if to_read == 0 {
            return Ok(());
        }
        let this = JsValue::NULL;
        let arg_offset = JsValue::from_f64(offset as f64);
        let arg_len = JsValue::from_f64(to_read as f64);
        if let Ok(res) = self.func.call2(&this, &arg_offset, &arg_len) {
            let uint8 = js_sys::Uint8Array::new(&res);
            let len = uint8.length() as usize;
            uint8.copy_to(&mut buf[..len]);
            Ok(())
        } else {
            Err("JS read failed".into())
        }
    }
}


/// Represents a file entry in the ext4 filesystem with its metadata.
#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct Ext4File {
    /// File size in bytes.
    #[serde(rename = "_size")]
    pub size: u64,
    /// UNIX file mode (permissions and type).
    #[serde(rename = "_mode")]
    pub mode: u16,
    /// User ID of the owner.
    #[serde(rename = "_uid")]
    pub uid: u32,
    /// Group ID of the owner.
    #[serde(rename = "_gid")]
    pub gid: u32,
    /// Full path to the file within the ext4 image.
    #[serde(rename = "_path")]
    pub path: String,
}

/// Represents a node in the ext4 filesystem tree, which can be either a directory
/// containing other nodes or a single file.
#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(untagged)]
pub enum Ext4Node {
    /// A directory entry, mapping file names to their corresponding nodes.
    Directory(BTreeMap<String, Ext4Node>),
    /// A file entry.
    File(Ext4File),
}

/// Parses an ext4 image from a byte vector and returns the hierarchical directory structure.
///
/// # Arguments
/// * `data` - A byte vector containing the raw ext4 image data.
///
/// # Returns
/// A result containing the root `Ext4Node` of the filesystem, or an error if parsing fails.
#[wasm_bindgen]
pub fn parse_ext4(data: Vec<u8>) -> Result<Ext4Node, JsError> {
    let fs = Ext4::load(Box::new(data)).map_err(|e| JsError::new(&format!("Failed to load ext4: {:?}", e)))?;
    walk_dir(&fs, "/")
}

/// Recursively walks a directory in the ext4 filesystem to build a tree structure.
fn walk_dir(fs: &Ext4, path: &str) -> Result<Ext4Node, JsError> {
    let mut children = BTreeMap::new();
    let entries = fs.read_dir(path).map_err(|e| JsError::new(&format!("Read dir error: {:?}", e)))?;

    for entry in entries {
        let entry = entry.map_err(|e| JsError::new(&format!("Entry error: {:?}", e)))?;
        let name = entry.file_name().display().to_string();
        if name == "." || name == ".." {
            continue;
        }

        let metadata = entry.metadata().map_err(|e| JsError::new(&format!("Metadata error: {:?}", e)))?;
        let full_path = entry.path().display().to_string();

        if metadata.is_dir() {
            children.insert(name, walk_dir(fs, &full_path)?);
        } else {
            children.insert(name, Ext4Node::File(Ext4File {
                size: metadata.len(),
                mode: metadata.mode(),
                uid: metadata.uid(),
                gid: metadata.gid(),
                path: full_path,
            }));
        }
    }
    Ok(Ext4Node::Directory(children))
}

/// Reads the content of a specific file from an ext4 image.
///
/// # Arguments
/// * `data` - A byte vector containing the raw ext4 image data.
/// * `path` - The absolute path of the file to read within the ext4 image.
///
/// # Returns
/// A result containing the file's content as a byte vector, or an error if reading fails.
#[wasm_bindgen]
pub fn parse_ext4_stream(size: u64, read_fn: js_sys::Function) -> Result<Ext4Node, JsError> {
    let reader = JsReader { func: read_fn, pos: 0, size };
    let fs = Ext4::load(Box::new(reader)).map_err(|e| JsError::new(&format!("Failed to load ext4: {:?}", e)))?;
    walk_dir(&fs, "/")
}

#[wasm_bindgen]
pub fn read_ext4_file(data: Vec<u8>, path: String) -> Result<Vec<u8>, JsError> {
    let fs = Ext4::load(Box::new(data)).map_err(|e| JsError::new(&format!("Failed to load ext4: {:?}", e)))?;
    let content = fs.read(&path).map_err(|e| JsError::new(&format!("Read file error: {:?}", e)))?;
    Ok(content)
}

#[wasm_bindgen]
pub fn read_ext4_file_stream(size: u64, read_fn: js_sys::Function, path: String) -> Result<Vec<u8>, JsError> {
    let reader = JsReader { func: read_fn, pos: 0, size };
    let fs = Ext4::load(Box::new(reader)).map_err(|e| JsError::new(&format!("Failed to load ext4: {:?}", e)))?;
    let content = fs.read(&path).map_err(|e| JsError::new(&format!("Read file error: {:?}", e)))?;
    Ok(content)
}
