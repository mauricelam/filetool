use std::collections::HashMap;

use anyhow::{format_err, Error};
use byteorder::{LittleEndian, WriteBytesExt};

use crate::{
    model::{
        value::{
            TOKEN_TYPE_ATTRIBUTE_REFERENCE_ID, TOKEN_TYPE_DIMENSION, TOKEN_TYPE_FRACTION,
            TOKEN_TYPE_REFERENCE_ID, TOKEN_TYPE_STRING,
        },
        Library as _, Value,
    },
    visitor::model::Library,
};

const MASK_COMPLEX: u16 = 0x0001;

#[allow(dead_code)]
#[derive(Debug, Copy, Clone)]
pub struct EntryHeader {
    header_size: u16,
    flags: u16,
    key_index: u32,
}

impl EntryHeader {
    pub fn new(header_size: u16, flags: u16, key_index: u32) -> Self {
        Self {
            header_size,
            flags,
            key_index,
        }
    }

    pub fn is_complex(self) -> bool {
        (self.flags & MASK_COMPLEX) == MASK_COMPLEX
    }

    pub fn get_key_index(self) -> u32 {
        self.key_index
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SimpleEntry {
    id: u32,
    key_index: u32,
    value_type: u8,
    value_data: u32,
}

impl SimpleEntry {
    pub fn to_string(&self, library: &Library) -> String {
        match self.value_type {
            TOKEN_TYPE_REFERENCE_ID => library.resid_to_string(self.value_data),
            TOKEN_TYPE_ATTRIBUTE_REFERENCE_ID => library.resid_to_string(self.value_data),
            TOKEN_TYPE_STRING => library
                .get_string(self.value_data)
                .map(|e| e.to_string())
                .unwrap_or_else(|_| format!("Unknown string({})", self.value_data)),
            _ => Value::create(self.value_type, self.value_data)
                .map(|x| x.to_string())
                .unwrap_or_else(|_| format!("Unknown({})", self.value_data)),
        }
    }
}

impl SimpleEntry {
    pub fn new(id: u32, key_index: u32, value_type: u8, value_data: u32) -> Self {
        Self {
            id,
            key_index,
            value_type,
            value_data,
        }
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }

    pub fn get_key(&self) -> u32 {
        self.key_index
    }

    pub fn get_type(&self) -> u8 {
        self.value_type
    }

    pub fn get_value(&self) -> u32 {
        self.value_data
    }

    pub fn to_vec(&self) -> Result<Vec<u8>, Error> {
        let mut out = Vec::new();

        // Header size
        out.write_u16::<LittleEndian>(8)?;

        // Flags => Simple entry
        out.write_u16::<LittleEndian>(0)?;

        // Key index
        out.write_u32::<LittleEndian>(self.get_key())?;

        // Value type
        out.write_u16::<LittleEndian>(8)?;
        out.write_u8(0)?;
        out.write_u8(self.get_type())?;

        // Value
        out.write_u32::<LittleEndian>(self.get_value())?;

        Ok(out)
    }
}

#[derive(Debug, Clone)]
pub struct ComplexEntry {
    id: u32,
    key_index: u32,
    parent_entry_id: u32,
    entries: Vec<SimpleEntry>,
}

impl ComplexEntry {
    pub fn to_hash_map(&self, library: &Library) -> HashMap<String, String> {
        self.entries
            .iter()
            .map(|e| (library.resid_to_string(e.get_id()), e.to_string(library)))
            .collect()
    }

    pub fn to_string(&self, library: &Library) -> String {
        let refname = library.resid_to_string(self.parent_entry_id);
        format!("parent: {refname}")
    }
}

impl ComplexEntry {
    pub fn new(id: u32, key_index: u32, parent_entry_id: u32, entries: Vec<SimpleEntry>) -> Self {
        Self {
            id,
            key_index,
            parent_entry_id,
            entries,
        }
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }

    pub fn get_key(&self) -> u32 {
        self.key_index
    }

    pub fn get_referent_id(&self, value: u32) -> Option<u32> {
        for e in &self.entries {
            if e.get_value() == value {
                return Some(e.get_id());
            }
        }

        None
    }

    pub fn get_entries(&self) -> &Vec<SimpleEntry> {
        &self.entries
    }

    pub fn to_vec(&self) -> Result<Vec<u8>, Error> {
        let mut out = Vec::new();

        // Header size
        out.write_u16::<LittleEndian>(16)?;

        // Flags => Complex entry
        out.write_u16::<LittleEndian>(1)?;

        // Key index
        out.write_u32::<LittleEndian>(self.key_index)?;

        // Parent entry
        out.write_u32::<LittleEndian>(self.parent_entry_id)?;

        // Children entry amount
        let children_amount = self.entries.len() as u32;
        if children_amount == 0 {
            out.write_u32::<LittleEndian>(0xFFFF_FFFF)?;
        } else {
            out.write_u32::<LittleEndian>(self.entries.len() as u32)?;
        }

        for e in &self.entries {
            // TODO: Unify this with simple entry without header
            // Key index
            out.write_u32::<LittleEndian>(e.get_id())?;

            // Value type
            out.write_u16::<LittleEndian>(8)?;
            out.write_u8(0)?;
            out.write_u8(e.get_type())?;

            // Value
            out.write_u32::<LittleEndian>(e.get_value())?;
        }

        Ok(out)
    }
}

#[derive(Debug, Clone)]
pub enum Entry {
    Empty(u32, u32),
    Simple(SimpleEntry),
    Complex(ComplexEntry),
}

impl Entry {
    pub fn to_string(&self, library: &Library) -> String {
        match self {
            Self::Empty(a, b) => format!("Empty({}, {})", a, b),
            Self::Simple(simple) => simple.to_string(library),
            Self::Complex(complex) => complex.to_string(library),
        }
    }

    pub fn simple(&self) -> Result<&SimpleEntry, Error> {
        if let Self::Simple(simple) = self {
            Ok(simple)
        } else {
            Err(format_err!("asked for a complex entry on a simple one"))
        }
    }

    pub fn complex(&self) -> Result<&ComplexEntry, Error> {
        if let Self::Complex(complex) = self {
            Ok(complex)
        } else {
            Err(format_err!("asked for a simple entry on a complex one"))
        }
    }

    pub fn is_empty(&self) -> bool {
        matches!(self, Self::Empty(_, _))
    }

    pub fn get_id(&self) -> u32 {
        match self {
            Self::Empty(id, _) => *id,
            Self::Simple(simple) => simple.get_id(),
            Self::Complex(complex) => complex.get_id(),
        }
    }

    pub fn get_key(&self) -> u32 {
        match self {
            Self::Empty(_, key) => *key,
            Self::Simple(simple) => simple.get_key(),
            Self::Complex(complex) => complex.get_key(),
        }
    }

    pub fn get_value(&self) -> Option<u32> {
        match self {
            Self::Empty(_, _) => None,
            Self::Simple(simple) => Some(simple.get_value()),
            Self::Complex(_) => None,
        }
    }

    pub fn to_vec(&self) -> Result<Vec<u8>, Error> {
        match self {
            Self::Complex(complex) => complex.to_vec(),
            Self::Simple(simple) => simple.to_vec(),
            Self::Empty(_, _) => Ok(Vec::new()),
        }
    }
}
