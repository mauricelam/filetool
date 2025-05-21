//! High level abstraction to easy the extraction to file system of APKs

use std::{
    fs::{self, File},
    io::{Cursor, Read, Seek, Write},
    path::Path,
};

use anyhow::anyhow;
use anyhow::{Context, Error};
use zip::read::ZipArchive;

use crate::decoder::BufferedDecoder;

#[derive(Debug)]
pub struct Apk<Reader: Read + Seek = File> {
    handler: ZipArchive<Reader>,
    decoder: BufferedDecoder,
}

impl<Reader: Read + Seek> Apk<Reader> {
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
}
