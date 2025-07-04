use byteorder::{LittleEndian, WriteBytesExt};
use anyhow::{format_err, Error};

use crate::model::{owned::OwnedBuf, TypeSpec};

#[derive(Debug)]
pub struct TableTypeSpecBuf {
    id: u16,
    flags: Vec<u32>,
}

impl TableTypeSpecBuf {
    pub fn new(id: u16) -> Self {
        Self {
            id,
            flags: Vec::new(),
        }
    }

    pub fn push_flag(&mut self, flag: u32) {
        self.flags.push(flag)
    }
}

impl OwnedBuf for TableTypeSpecBuf {
    fn get_token(&self) -> u16 {
        0x202
    }

    fn get_body_data(&self) -> Result<Vec<u8>, Error> {
        let mut out = Vec::new();

        for flag in &self.flags {
            out.write_u32::<LittleEndian>(*flag)?;
        }

        Ok(out)
    }

    fn get_header(&self) -> Result<Vec<u8>, Error> {
        let mut out = Vec::new();

        out.write_u32::<LittleEndian>(u32::from(self.id))?;
        out.write_u32::<LittleEndian>(self.flags.len() as u32)?;

        Ok(out)
    }
}

impl TypeSpec for TableTypeSpecBuf {
    fn get_id(&self) -> Result<u16, Error> {
        Ok(self.id)
    }
    fn get_amount(&self) -> Result<u32, Error> {
        Ok(self.flags.len() as u32)
    }

    fn get_flag(&self, index: u32) -> Result<u32, Error> {
        self.flags
            .get(index as usize)
            .cloned()
            .ok_or_else(|| format_err!("flag out of bounds"))
    }
}

#[cfg(test)]
mod tests {
    use super::{TableTypeSpecBuf, TypeSpec};
    use crate::{
        chunks::TypeSpecWrapper, model::owned::OwnedBuf, raw_chunks, test::compare_chunks,
    };

    #[test]
    fn it_can_generate_a_chunk_with_the_given_data() {
        let type_spec = TableTypeSpecBuf::new(14);

        assert_eq!(14, type_spec.get_id().unwrap());
    }

    #[test]
    fn identity() {
        let wrapper = TypeSpecWrapper::new(raw_chunks::EXAMPLE_TYPE_SPEC);

        let owned = wrapper.to_buffer().unwrap();
        let new_raw = owned.to_vec().unwrap();

        compare_chunks(&new_raw, &raw_chunks::EXAMPLE_TYPE_SPEC);
    }
}
