//! High level abstraction to easy the extraction to file system of APKs

use std::{
    collections::HashMap,
    convert::TryInto,
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
pub struct SignerInfo {
    pub sha256_digest: String,
    pub sha1_digest: String,
    pub md5_digest: String,
    pub subject: String,
}

#[derive(Debug, serde::Serialize, Clone)]
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
    pub fn get_metadata_with_bytes(&mut self, bytes: &[u8], buffer_android: &[u8]) -> Result<ApkMetadata, Error> {
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

        let mut v2_signature = false;
        let mut v3_signature = false;
        let mut signers = Vec::new();

        if let Ok(signing_block) = self.find_signing_block(bytes) {
            if signing_block.contains_key(&0x7109871a) {
                v2_signature = true;
                if let Some(v2_data) = signing_block.get(&0x7109871a) {
                    signers.extend(self.parse_signing_block_v2_v3(v2_data)?);
                }
            }
            if signing_block.contains_key(&0xf9511388) {
                v3_signature = true;
                if signers.is_empty() {
                    if let Some(v3_data) = signing_block.get(&0xf9511388) {
                        signers.extend(self.parse_signing_block_v2_v3(v3_data)?);
                    }
                }
            }
        }

        // Try to get manifest info
        if let Ok(mut manifest_file) = self.handler.by_name("AndroidManifest.xml") {
            let mut contents = Vec::new();
            manifest_file.read_to_end(&mut contents)?;

            let decoder = self.decoder.get_decoder(buffer_android)?;
            let xml_visitor = decoder.xml_visitor(&contents)?;
            if let Some(root) = xml_visitor.get_roots().first() {
                manifest_info = Some(Self::extract_manifest_info(root));
            }
        }

        Ok(ApkMetadata {
            manifest: manifest_info,
            v1_signature,
            v2_signature,
            v3_signature,
            signers,
            jar_signatures,
            file_count,
            uncompressed_size,
        })
    }

    pub fn get_metadata(&mut self, buffer_android: &[u8]) -> Result<ApkMetadata, Error> {
        // This is a fallback if bytes are not available, but for now we expect them
        // in our current use case.
        self.get_metadata_with_bytes(&[], buffer_android)
    }

    #[cfg(test)]
    pub(crate) fn find_signing_block_for_test(bytes: &[u8]) -> Result<HashMap<u32, Vec<u8>>, Error> {
        Self::find_signing_block_internal(bytes)
    }

    fn find_signing_block(&self, bytes: &[u8]) -> Result<HashMap<u32, Vec<u8>>, Error> {
        Self::find_signing_block_internal(bytes)
    }

    fn find_signing_block_internal(bytes: &[u8]) -> Result<HashMap<u32, Vec<u8>>, Error> {
        if bytes.len() < 22 {
            return Err(anyhow!("File too small"));
        }

        // Find EOCD
        let mut eocd_pos = None;
        for i in (0..bytes.len() - 21).rev() {
            if &bytes[i..i + 4] == b"\x50\x4b\x05\x06" {
                eocd_pos = Some(i);
                break;
            }
        }

        let eocd_pos = eocd_pos.ok_or_else(|| anyhow!("EOCD not found"))?;
        let cd_offset = u32::from_le_bytes(bytes[eocd_pos + 16..eocd_pos + 20].try_into()?) as usize;

        if cd_offset < 32 {
            return Err(anyhow!("Central Directory offset too small for Signing Block"));
        }

        // APK Signing Block is right before Central Directory
        if bytes.len() < cd_offset {
            return Err(anyhow!("Invalid offset"));
        }

        let magic = &bytes[cd_offset - 16..cd_offset];
        if magic != b"APK Sig Block 42" {
            return Err(anyhow!("APK Signing Block magic not found"));
        }

        let block_size_low = u64::from_le_bytes(bytes[cd_offset - 24..cd_offset - 16].try_into()?);
        let block_start = cd_offset - 8 - block_size_low as usize;
        let block_size_high = u64::from_le_bytes(bytes[block_start..block_start + 8].try_into()?);

        if block_size_low != block_size_high {
            return Err(anyhow!("APK Signing Block size mismatch"));
        }

        let mut pos = block_start + 8;
        let mut pairs = HashMap::new();
        while pos < cd_offset - 24 {
            let pair_size = u64::from_le_bytes(bytes[pos..pos + 8].try_into()?) as usize;
            let id = u32::from_le_bytes(bytes[pos + 8..pos + 12].try_into()?);
            let value = bytes[pos + 12..pos + 8 + pair_size].to_vec();
            pairs.insert(id, value);
            pos += 8 + pair_size;
        }

        Ok(pairs)
    }

    fn parse_signing_block_v2_v3(&self, data: &[u8]) -> Result<Vec<SignerInfo>, Error> {
        // data is the value of the V2/V3 ID-value pair.
        // It starts with a length-prefixed sequence of signers.
        if data.len() < 4 {
            return Ok(vec![]);
        }

        let mut signers = Vec::new();
        let signers_len = u32::from_le_bytes(data[0..4].try_into()?) as usize;
        let mut pos = 4;
        let end = 4 + signers_len;

        while pos < end && pos + 4 <= data.len() {
            let signer_len = u32::from_le_bytes(data[pos..pos + 4].try_into()?) as usize;
            pos += 4;
            if pos + signer_len > data.len() {
                break;
            }
            let signer_data = &data[pos..pos + signer_len];
            pos += signer_len;

            // Inside signer data:
            // - length-prefixed signed data
            // - length-prefixed sequence of signatures
            // - length-prefixed public key
            if signer_data.len() < 4 {
                continue;
            }
            let signed_data_len = u32::from_le_bytes(signer_data[0..4].try_into()?) as usize;
            if signed_data_len + 4 > signer_data.len() {
                continue;
            }
            let signed_data = &signer_data[4..4 + signed_data_len];

            // Inside signed data:
            // - length-prefixed sequence of digests
            // - length-prefixed sequence of certificates
            // - ...
            if signed_data.len() < 4 {
                continue;
            }
            let digests_len = u32::from_le_bytes(signed_data[0..4].try_into()?) as usize;
            let certs_pos = 4 + digests_len;
            if certs_pos + 4 > signed_data.len() {
                continue;
            }
            let certs_len = u32::from_le_bytes(signed_data[certs_pos..certs_pos + 4].try_into()?) as usize;
            if certs_pos + 4 + certs_len > signed_data.len() {
                continue;
            }
            let certs_data = &signed_data[certs_pos + 4..certs_pos + 4 + certs_len];

            // Inside certs_data: sequence of length-prefixed certificates.
            // We take the first one.
            if certs_data.len() < 4 {
                continue;
            }
            let first_cert_len = u32::from_le_bytes(certs_data[0..4].try_into()?) as usize;
            if first_cert_len + 4 > certs_data.len() {
                continue;
            }
            let first_cert = &certs_data[4..4 + first_cert_len];

            use sha2::{Digest, Sha256};
            let sha256_digest = hex::encode(Sha256::digest(first_cert));

            use sha1::Sha1;
            let mut sha1_hasher = Sha1::new();
            sha1_hasher.update(first_cert);
            let sha1_digest = hex::encode(sha1_hasher.finalize());

            use md5::Md5;
            let mut md5_hasher = Md5::new();
            md5_hasher.update(first_cert);
            let md5_digest = hex::encode(md5_hasher.finalize());

            use x509_parser::prelude::*;
            let subject = match X509Certificate::from_der(first_cert) {
                Ok((_, cert)) => cert.subject().to_string(),
                Err(_) => "Unknown".to_string(),
            };

            signers.push(SignerInfo {
                sha256_digest,
                sha1_digest,
                md5_digest,
                subject,
            });
        }

        Ok(signers)
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

    pub fn export_string(&mut self, buffer_android: &[u8]) -> Result<Vec<(String, Vec<u8>)>, Error> {
        use crate::visitor::XmlVisitor;

        let decoder = self
            .decoder
            .get_decoder(buffer_android)
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
    pub fn export<P: AsRef<Path>>(&mut self, output_path: P, force: bool, buffer_android: &[u8]) -> Result<(), Error> {
        use crate::visitor::XmlVisitor;

        let decoder = self
            .decoder
            .get_decoder(buffer_android)
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

    pub fn list_resources(&mut self, buffer_android: &[u8]) -> Result<Vec<ArscResource>, Error> {
        let decoder = self
            .decoder
            .get_decoder(buffer_android)
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
                for (entry_id, entries) in package.iter_entries() {
                    if (entry_id >> 16) == *type_id {
                        let entry_name = package
                            .get_entries_string(*entry_id)
                            .map(|s| s.to_string())
                            .unwrap_or_else(|_| format!("entry_{}", entry_id & 0xFFFF));

                        let entry = entries.first().map(|(_c, e)| e).unwrap();
                        let value = entry
                            .get_value()
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

    pub fn get_file_names(&self) -> Vec<String> {
        self.handler.file_names().map(|s| s.to_string()).collect()
    }

    pub fn extract_file(&mut self, name: &str, buffer_android: &[u8]) -> Result<Vec<u8>, Error> {
        let mut current_file = self.handler.by_name(name).context("could not find file")?;
        let mut contents = Vec::new();
        current_file.read_to_end(&mut contents).context("could not read file")?;

        if (name.starts_with("res/") && name.ends_with(".xml")) || name == "AndroidManifest.xml" {
            if let Ok(decoder) = self.decoder.get_decoder(buffer_android) {
                if let Ok(xml_visitor) = decoder.xml_visitor(&contents) {
                    if let Ok(decoded) = xml_visitor.into_string() {
                        return Ok(decoded.into_bytes());
                    }
                }
            }
        }
        Ok(contents)
    }
}
