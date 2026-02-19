use std::collections::BTreeMap;
use serde::Serialize;
use tsify::Tsify;
use wasm_bindgen::prelude::*;
use ext4_view::Ext4;

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct Ext4File {
    #[serde(rename = "_size")]
    pub size: u64,
    #[serde(rename = "_mode")]
    pub mode: u16,
    #[serde(rename = "_uid")]
    pub uid: u32,
    #[serde(rename = "_gid")]
    pub gid: u32,
    #[serde(rename = "_path")]
    pub path: String,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(untagged)]
pub enum Ext4Node {
    Directory(BTreeMap<String, Ext4Node>),
    File(Ext4File),
}

#[wasm_bindgen]
pub fn parse_ext4(data: Vec<u8>) -> Result<Ext4Node, JsError> {
    let fs = Ext4::load(Box::new(data)).map_err(|e| JsError::new(&format!("Failed to load ext4: {:?}", e)))?;
    walk_dir(&fs, "/")
}

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

#[wasm_bindgen]
pub fn read_ext4_file(data: Vec<u8>, path: String) -> Result<Vec<u8>, JsError> {
    let fs = Ext4::load(Box::new(data)).map_err(|e| JsError::new(&format!("Failed to load ext4: {:?}", e)))?;
    let content = fs.read(&path).map_err(|e| JsError::new(&format!("Read file error: {:?}", e)))?;
    Ok(content)
}
