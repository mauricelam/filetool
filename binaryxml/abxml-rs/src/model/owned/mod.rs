use std::fmt::Debug;

use byteorder::{LittleEndian, WriteBytesExt};
use anyhow::{Error, Context};

pub use self::{
    package::PackageBuf,
    resources::ResourcesBuf,
    string_table::{Encoding, StringTableBuf},
    table_type::{ComplexEntry, ConfigurationBuf, Entry, EntryHeader, SimpleEntry, TableTypeBuf},
    table_type_spec::TableTypeSpecBuf,
    xml::{AttributeBuf, XmlNamespaceEndBuf, XmlNamespaceStartBuf, XmlTagEndBuf, XmlTagStartBuf},
};

mod package;
mod resources;
mod string_table;
mod table_type;
mod table_type_spec;
mod xml;

/// Implementors are able to be converted to well formed chunks as expected on `ChunkLoaderStream`
pub trait OwnedBuf: Debug {
    /// Token that identifies the current chunk
    fn get_token(&self) -> u16;
    /// Return the bytes corresponding to chunk's body
    fn get_body_data(&self) -> Result<Vec<u8>, Error>;

    /// Return the bytes corresponding to chunk's header
    fn get_header(&self) -> Result<Vec<u8>, Error> {
        Ok(Vec::new())
    }

    /// Convert the given `OwnedBuf` to a well formed chunk in form of vector of bytes
    fn to_vec(&self) -> Result<Vec<u8>, Error> {
        let mut out = Vec::new();
        let body = self.get_body_data().context("could not read chunk body")?;

        self.write_header(&mut out, &body)
            .context("could not write header")?;

        out.extend(body.iter());

        Ok(out)
    }

    /// Writes the header to the output buffer. It writes token, header size and chunk_size and
    /// then the data returned by `get_header`.
    fn write_header(&self, buffer: &mut Vec<u8>, body: &[u8]) -> Result<(), Error> {
        let header = self.get_header()?;
        let header_size = header.len() as u16 + 8;

        buffer.write_u16::<LittleEndian>(self.get_token())?;
        buffer.write_u16::<LittleEndian>(header_size)?;
        buffer.write_u32::<LittleEndian>(body.len() as u32 + u32::from(header_size))?;
        buffer.extend(&header);

        Ok(())
    }
}
