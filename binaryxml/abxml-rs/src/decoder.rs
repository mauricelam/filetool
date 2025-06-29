//! Structs which contains the read data from binary documents

use std::io::{Cursor, Read};

use anyhow::{Context, Error};

use crate::{
    visitor::{Executor, ModelVisitor, Resources, XmlVisitor},
    STR_ARSC,
};

#[derive(Debug)]
pub struct BufferedDecoder {
    buffer: Box<[u8]>,
}

impl<T> From<T> for BufferedDecoder
where
    T: Into<Box<[u8]>>,
{
    fn from(buffer: T) -> Self {
        Self {
            buffer: buffer.into(),
        }
    }
}

impl BufferedDecoder {
    pub fn from_read<R: Read>(mut read: R) -> Result<Self, Error> {
        let mut buffer = Vec::new();
        read.read_to_end(&mut buffer)
            .context("could not read buffer")?;
        Ok(Self {
            buffer: buffer.into_boxed_slice(),
        })
    }

    pub fn get_decoder(&self) -> Result<Decoder, Error> {
        Decoder::from_buffer(&self.buffer)
    }
}

#[derive(Debug)]
pub struct Decoder<'a> {
    visitor: ModelVisitor<'a>,
    buffer_android: &'a [u8],
    buffer_apk: &'a [u8],
}

impl<'a> Decoder<'a> {
    pub fn from_buffer(buffer_apk: &'a [u8]) -> Result<Self, Error> {
        let visitor = ModelVisitor::default();

        let mut decoder = Self {
            visitor,
            buffer_android: STR_ARSC,
            buffer_apk,
        };

        Executor::arsc(decoder.buffer_android, &mut decoder.visitor)
            .context("could not read Android lib resources")?;
        Executor::arsc(decoder.buffer_apk, &mut decoder.visitor)
            .context("could not read target APK resources")?;

        Ok(decoder)
    }

    pub fn from_arsc(buffer: &'a [u8]) -> Result<ModelVisitor<'a>, Error> {
        let mut visitor = ModelVisitor::default();

        Executor::arsc(STR_ARSC, &mut visitor).context("could not read Android lib resources")?;
        Executor::arsc(buffer, &mut visitor).context("could not read ARSC resources")?;

        Ok(visitor)
    }

    pub fn get_resources(&self) -> &'a Resources {
        self.visitor.get_resources()
    }

    pub fn xml_visitor<T: AsRef<[u8]>>(&self, content: &'a T) -> Result<XmlVisitor, Error> {
        let cursor = Cursor::new(content.as_ref());
        let mut visitor = XmlVisitor::new(self.get_resources());

        Executor::xml(cursor, &mut visitor)?;

        Ok(visitor)
    }
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::BufferedDecoder;

    #[test]
    fn it_can_not_decode_an_empty_binary_xml() {
        // Empty resources.arsc file
        let buffer = vec![2, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        let owned = BufferedDecoder::from(buffer);
        let decoder = owned.get_decoder().unwrap();

        // Empty binary XML file
        let another = vec![3, 0, 0, 0, 0, 0, 0, 0];
        let xml_result = decoder.xml_visitor(&another).unwrap().into_string();
        assert!(xml_result.is_err());
    }

    #[test]
    fn it_can_create_a_buffer_decoder_from_read() {
        let buffer = vec![2, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        let owned = BufferedDecoder::from_read(Cursor::new(buffer)).unwrap();
        let _ = owned.get_decoder().unwrap();
    }
}
