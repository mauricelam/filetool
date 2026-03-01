//! High level abstraction to easy the extraction to file system of APKs

use std::{
    fs::{self, File},
    io::{Cursor, Read, Seek, Write},
    path::Path,
};

use anyhow::anyhow;
use anyhow::{Context, Error};
use zip::read::ZipArchive;

use crate::{
    decoder::BufferedDecoder,
    model::{Element, Library as LibraryTrait},
};

#[derive(Debug)]
pub struct Apk<Reader: Read + Seek = File> {
    handler: ZipArchive<Reader>,
    decoder: BufferedDecoder,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct ManifestInfo {
    pub package: String,
    pub version_code: Option<String>,
    pub version_name: Option<String>,
    pub min_sdk_version: Option<String>,
    pub target_sdk_version: Option<String>,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct ApkMetadata {
    pub manifest: Option<ManifestInfo>,
    pub v1_signature: bool,
    pub jar_signatures: Vec<String>,
    pub file_count: usize,
    pub uncompressed_size: u64,
}

#[derive(Debug, serde::Serialize)]
pub struct ArscResource {
    pub package_id: u8,
    pub type_id: u8,
    pub type_name: String,
    pub entry_id: u16,
    pub name: String,
    pub value: String,
}

impl<Reader: Read + Seek> Apk<Reader> {
    pub fn get_metadata(&mut self) -> Result<ApkMetadata, Error> {
        let mut v1_signature = false;
        let mut jar_signatures = Vec::new();
        let mut uncompressed_size = 0;
        let file_count = self.handler.len();
        let mut manifest_info = None;

        for i in 0..file_count {
            let file = self.handler.by_index(i)?;
            uncompressed_size += file.size();
            let name = file.name();
            if name.starts_with("META-INF/")
                && (name.ends_with(".RSA") || name.ends_with(".DSA") || name.ends_with(".EC"))
            {
                v1_signature = true;
                jar_signatures.push(name.to_string());
            }
        }

        // Try to get manifest info
        if let Ok(mut manifest_file) = self.handler.by_name("AndroidManifest.xml") {
            let mut contents = Vec::new();
            manifest_file.read_to_end(&mut contents)?;

            let decoder = self.decoder.get_decoder()?;
            let xml_visitor = decoder.xml_visitor(&contents)?;
            if let Some(root) = xml_visitor.get_root() {
                manifest_info = Some(Self::extract_manifest_info(root));
            }
        }

        Ok(ApkMetadata {
            manifest: manifest_info,
            v1_signature,
            jar_signatures,
            file_count,
            uncompressed_size,
        })
    }

    fn extract_manifest_info(root: &Element) -> ManifestInfo {
        let attrs = root.get_attributes();
        let package = attrs.get("package").cloned().unwrap_or_default();

        let get_attr = |name: &str| {
            attrs
                .get(name)
                .cloned()
                .or_else(|| attrs.get(&format!("android:{}", name)).cloned())
        };

        let version_code = get_attr("versionCode");
        let version_name = get_attr("versionName");

        let mut min_sdk = None;
        let mut target_sdk = None;

        for child in root.get_children() {
            if child.get_tag().get_name().as_str() == "uses-sdk" {
                let sdk_attrs = child.get_attributes();
                let get_sdk_attr = |name: &str| {
                    sdk_attrs
                        .get(name)
                        .cloned()
                        .or_else(|| sdk_attrs.get(&format!("android:{}", name)).cloned())
                };
                min_sdk = get_sdk_attr("minSdkVersion");
                target_sdk = get_sdk_attr("targetSdkVersion");
            }
        }

        ManifestInfo {
            package,
            version_code,
            version_name,
            min_sdk_version: min_sdk,
            target_sdk_version: target_sdk,
        }
    }

    pub fn from_path<P: AsRef<Path>>(path: P) -> Result<Apk<File>, Error> {
        let mut buffer = Vec::new();
        let file = File::open(&path)?;
        let mut zip_handler = ZipArchive::new(file)?;
        zip_handler
            .by_name("resources.arsc")?
            .read_to_end(&mut buffer)?;

        Ok(Apk {
            handler: zip_handler,
            decoder: buffer.into(),
        })
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Apk<Cursor<&[u8]>>, Error> {
        let mut buffer = Vec::new();
        let mut zip_handler = ZipArchive::new(Cursor::new(bytes))?;
        zip_handler
            .by_name("resources.arsc")?
            .read_to_end(&mut buffer)?;

        Ok(Apk {
            handler: zip_handler,
            decoder: buffer.into(),
        })
    }

    pub fn export_string(&mut self) -> Result<Vec<(String, Vec<u8>)>, Error> {
        use crate::visitor::XmlVisitor;

        let decoder = self
            .decoder
            .get_decoder()
            .context("could not get the decoder")?;

        let mut result = Vec::new();

        // Iterate over all the files on the ZIP and extract them
        for i in 0..self.handler.len() {
            let (file_name, contents) = {
                let mut current_file = self
                    .handler
                    .by_index(i)
                    .context("could not read ZIP entry")?;
                let mut contents = Vec::new();
                current_file
                    .read_to_end(&mut contents)
                    .context(format!("could not read: {}", current_file.name()))?;
                let is_xml = current_file.name().to_string();

                (is_xml, contents)
            };

            let contents = if (file_name.starts_with("res/") && file_name.ends_with(".xml"))
                || file_name == "AndroidManifest.xml"
            {
                decoder
                    .xml_visitor(&contents)
                    .and_then(XmlVisitor::into_string)
                    .map(String::into_bytes)
                    .unwrap_or(contents)
            } else {
                contents
            };

            result.push((file_name, contents));
        }
        Ok(result)
    }

    /// It exports to target output_path the contents of the APK, transcoding the binary XML files
    /// found on it.
    pub fn export<P: AsRef<Path>>(&mut self, output_path: P, force: bool) -> Result<(), Error> {
        use crate::visitor::XmlVisitor;

        let decoder = self
            .decoder
            .get_decoder()
            .context("could not get the decoder")?;

        if fs::create_dir_all(&output_path).is_err() && force {
            fs::remove_dir_all(&output_path).context(anyhow!(
                "could not clean target directory: {}",
                output_path.as_ref().display()
            ))?;
            fs::create_dir_all(&output_path).context(anyhow!(
                "error creating the output folder: {}",
                output_path.as_ref().display()
            ))?;
        }

        // Iterate over all the files on the ZIP and extract them
        for i in 0..self.handler.len() {
            let (file_name, contents) = {
                let mut current_file = self
                    .handler
                    .by_index(i)
                    .context("could not read ZIP entry")?;
                let mut contents = Vec::new();
                current_file
                    .read_to_end(&mut contents)
                    .context(format!("could not read: {}", current_file.name()))?;
                let is_xml = current_file.name().to_string();

                (is_xml, contents)
            };

            let contents = if (file_name.starts_with("res/") && file_name.ends_with(".xml"))
                || file_name == "AndroidManifest.xml"
            {
                decoder
                    .xml_visitor(&contents)
                    .and_then(XmlVisitor::into_string)
                    .map(String::into_bytes)
                    .unwrap_or(contents)
            } else {
                contents
            };

            Self::write_file(&output_path, &file_name, &contents)
                .context("could not write output file")?;
        }
        Ok(())
    }

    fn write_file<B: AsRef<Path>, R: AsRef<Path>>(
        base_path: B,
        relative: R,
        content: &[u8],
    ) -> Result<(), Error> {
        let full_path = base_path.as_ref().join(&relative);
        // println!("Full path: {}", full_path.display());
        fs::create_dir_all(full_path.parent().unwrap())
            .context("could not create the output dir")?;

        let mut descriptor = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(full_path)
            .context("could not open file to write")?;

        descriptor
            .write_all(content)
            .context("could not write to target file")?;

        Ok(())
    }

    pub fn list_resources(&mut self) -> Result<Vec<ArscResource>, Error> {
        let decoder = self
            .decoder
            .get_decoder()
            .context("could not get the decoder")?;

        let resources = decoder.get_resources();
        let mut result = Vec::new();

        // Iterate through all packages
        for (package_id, package) in resources.packages.iter() {
            // Get package name
            let package_name = package.get_name().unwrap_or_else(|| format!("package_{}", package_id));

            // Iterate through all type specs
            for (type_id, _type_spec) in package.iter_specs() {
                // Get type name
                let type_name = package.get_spec_string(*type_id)
                    .map(|s| s.to_string())
                    .unwrap_or_else(|_| format!("type_{}", type_id));

                // Get entries for this type
                for (entry_id, entry) in package.iter_entries() {
                    if (entry_id >> 16) == *type_id {
                        let entry_name = package.get_entries_string(*entry_id)
                            .map(|s| s.to_string())
                            .unwrap_or_else(|_| format!("entry_{}", entry_id & 0xFFFF));

                        let value = entry.get_value()
                            .map(|v| v.to_string())
                            .unwrap_or_else(|| "".to_string());

                        result.push(ArscResource {
                            package_id: *package_id,
                            type_id: *type_id as u8,
                            type_name: type_name.clone(),
                            entry_id: (entry_id & 0xFFFF) as u16,
                            name: format!("{}:{}:{}", package_name, type_name, entry_name),
                            value,
                        });
                    }
                }
            }
        }

        Ok(result)
    }
}
