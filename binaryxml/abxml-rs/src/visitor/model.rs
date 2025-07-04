use std::{cell::RefCell, collections::HashMap, rc::Rc};

use anyhow::{format_err, Context, Error};
use log::error;

use crate::{
    chunks::{
        PackageWrapper, StringTableCache, StringTableWrapper, TableTypeWrapper, TypeSpecWrapper,
    },
    model::{
        owned::Entry, Entries, Identifier, Library as LibraryTrait, LibraryBuilder,
        Resources as ResourcesTrait, StringTable as StringTableTrait, TypeSpec as TypeSpecTrait,
    },
};

use super::{ChunkVisitor, Origin};

#[derive(Default, Debug)]
pub struct ModelVisitor<'a> {
    package_mask: u32,
    resources: Resources<'a>,
    current_spec: Option<TypeSpecWrapper<'a>>,
    tables: HashMap<Origin, StringTableCache<StringTableWrapper<'a>>>,
}

impl<'a> ModelVisitor<'a> {
    pub fn get_resources(&self) -> &'a Resources {
        &self.resources
    }

    pub fn get_mut_resources(&mut self) -> &'a mut Resources {
        &mut self.resources
    }
}

impl<'a> ChunkVisitor<'a> for ModelVisitor<'a> {
    fn visit_string_table(&mut self, string_table: StringTableWrapper<'a>, origin: Origin) {
        if let Origin::Global = origin {
            self.tables
                .insert(origin, StringTableCache::new(string_table));
        } else {
            let package_id = self.package_mask.get_package();

            let st_res = self.resources.get_mut_package(package_id).map(|package| {
                package.set_string_table(StringTableCache::new(string_table), origin);
            });

            if st_res.is_none() {
                error!("Could not retrieve target package");
            }
        }
    }

    fn visit_package(&mut self, package: PackageWrapper<'a>) {
        if let Ok(package_id) = package.get_id() {
            self.package_mask = package_id << 24;

            let package_id = self.package_mask.get_package();
            let rp = Library::new(package);

            self.resources.push_package(package_id, rp);

            if self.tables.contains_key(&Origin::Global) {
                if let Some(st) = self.tables.remove(&Origin::Global) {
                    let set_result = self.resources.get_mut_package(package_id).map(|package| {
                        package.set_string_table(st, Origin::Global);
                    });

                    if set_result.is_none() {
                        error!(
                            "could not set the string table because it refers to a non-existing \
                             package"
                        );
                    }
                }
            }
        }
    }

    fn visit_table_type(&mut self, table_type: TableTypeWrapper<'a>) {
        let mut entries = Entries::new();

        if let Some(ts) = &self.current_spec {
            let mask = ts
                .get_id()
                .and_then(|id| Ok(self.package_mask | (u32::from(id) << 16)))
                .unwrap_or(0);

            let entries_result = table_type.get_entries();

            match entries_result {
                Ok(ventries) => {
                    for e in &ventries {
                        let id = mask | e.get_id();

                        if !e.is_empty() {
                            entries.insert(id, e.clone());
                        }
                    }
                }
                Err(err) => error!("Error visiting table_type: {}", err),
            }
        }

        let package_id = self.package_mask.get_package();

        self.resources
            .get_mut_package(package_id)
            .and_then(|package| {
                package.add_entries(entries);
                Some(())
            });
    }

    fn visit_type_spec(&mut self, type_spec: TypeSpecWrapper<'a>) {
        self.current_spec = Some(type_spec.clone());
        let package_id = (self.package_mask >> 24) as u8;
        if let Some(package) = self.resources.get_mut_package(package_id) {
            let _ = package
                .add_type_spec(type_spec)
                .map_err(|e| error!("Could not add type spec: {}", e));
        } else {
            error!("Type spec refers to a non existing package");
        }
    }
}

pub type RefPackage<'a> = Rc<RefCell<Library<'a>>>;

#[derive(Default, Debug)]
pub struct Resources<'a> {
    pub packages: HashMap<u8, Library<'a>>,
    main_package: Option<u8>,
}

impl<'a> Resources<'a> {
    pub fn push_package(&mut self, package_id: u8, package: Library<'a>) {
        if self.packages.is_empty() {
            self.main_package = Some(package_id);
        }

        self.packages.insert(package_id, package);
    }
}

impl<'a> ResourcesTrait<'a> for Resources<'a> {
    type Library = Library<'a>;

    fn get_package(&self, package_id: u8) -> Option<&Self::Library> {
        self.packages.get(&package_id)
    }

    fn get_mut_package(&mut self, package_id: u8) -> Option<&mut Self::Library> {
        self.packages.get_mut(&package_id)
    }

    fn get_main_package(&self) -> Option<&Self::Library> {
        match self.main_package {
            Some(package_id) => match self.packages.get(&package_id) {
                Some(package) => Some(package),
                None => None,
            },
            _ => None,
        }
    }

    fn is_main_package(&self, package_id: u8) -> bool {
        match self.main_package {
            Some(pid) => pid == package_id,
            None => false,
        }
    }
}

#[derive(Debug)]
pub struct Library<'a> {
    package: PackageWrapper<'a>,
    specs: HashMap<u32, TypeSpecWrapper<'a>>,
    string_table: Option<StringTableCache<StringTableWrapper<'a>>>,
    spec_string_table: Option<StringTableCache<StringTableWrapper<'a>>>,
    entries_string_table: Option<StringTableCache<StringTableWrapper<'a>>>,
    entries: Entries,
}

impl<'a> Library<'a> {
    pub fn new(package: PackageWrapper<'a>) -> Self {
        Self {
            package,
            specs: HashMap::new(),
            string_table: None,
            spec_string_table: None,
            entries_string_table: None,
            entries: Entries::default(),
        }
    }

    pub fn iter_specs(&self) -> impl Iterator<Item = (&u32, &TypeSpecWrapper<'a>)> {
        self.specs.iter()
    }

    pub fn iter_entries(&self) -> impl Iterator<Item = (&u32, &Entry)> {
        self.entries.iter()
    }

    pub fn get_string(&self, str_id: u32) -> Result<Rc<String>, Error> {
        if let Some(string_table) = &self.string_table {
            let out_string = string_table.get_string(str_id).context(format_err!(
                "could not find string {} on string table",
                str_id
            ))?;

            return Ok(out_string);
        }

        Err(format_err!("string not found on string table"))
    }

    pub fn get_spec_as_str(&self, spec_id: u32) -> Result<String, Error> {
        if self.specs.get(&(spec_id)).is_some() {
            if let Some(spec_string_table) = &self.spec_string_table {
                if let Ok(spec_str) = spec_string_table.get_string(spec_id - 1) {
                    return Ok((*spec_str).clone());
                }
            }
        }

        Err(format_err!("could not retrieve spec as string"))
    }
}

impl<'a> LibraryTrait for Library<'a> {
    fn get_name(&self) -> Option<String> {
        self.package.get_name().ok()
    }

    fn format_reference(
        &self,
        id: u32,
        key: u32,
        namespace: Option<String>,
    ) -> Result<String, Error> {
        let spec_id = u32::from(id.get_spec());
        let spec_str = self
            .get_spec_as_str(spec_id)
            .context(format_err!("could not find spec: {}", spec_id))?;
        let string = self.get_entries_string(key).context(format_err!(
            "could not find key {} on entries string table",
            key
        ))?;

        let ending = format!("{}/{}", spec_str, string);

        let prefix = if spec_str == "attr" { "?" } else { "@" };

        match namespace {
            Some(ns) => Ok(format!("{}{}:{}", prefix, ns, ending)),
            None => Ok(format!("{}{}", prefix, ending)),
        }
    }

    fn get_entry(&self, id: u32) -> Result<&Entry, Error> {
        self.entries
            .get(&id)
            .ok_or_else(|| format_err!("could not find entry"))
    }

    fn get_entries_string(&self, str_id: u32) -> Result<Rc<String>, Error> {
        if let Some(string_table) = &self.entries_string_table {
            let out_string = string_table.get_string(str_id).context(format_err!(
                "could not find string {} on entries string table",
                str_id
            ))?;

            return Ok(out_string);
        }

        Err(format_err!("string not found on entries string table"))
    }

    fn get_spec_string(&self, str_id: u32) -> Result<Rc<String>, Error> {
        if let Some(string_table) = &self.spec_string_table {
            let out_string = string_table.get_string(str_id).context(format_err!(
                "could not find string {} on spec string table",
                str_id
            ))?;

            return Ok(out_string);
        }

        Err(format_err!("string not found on spec string table"))
    }
}

impl<'a> LibraryBuilder<'a> for Library<'a> {
    type StringTable = StringTableCache<StringTableWrapper<'a>>;
    type TypeSpec = TypeSpecWrapper<'a>;

    fn set_string_table(&mut self, string_table: Self::StringTable, origin: Origin) {
        match origin {
            Origin::Global => self.string_table = Some(string_table),
            Origin::Spec => self.spec_string_table = Some(string_table),
            Origin::Entries => self.entries_string_table = Some(string_table),
        }
    }

    fn add_entries(&mut self, entries: Entries) {
        self.entries.extend(entries);
    }

    fn add_type_spec(&mut self, type_spec: Self::TypeSpec) -> Result<(), Error> {
        let id = u32::from(type_spec.get_id()?);
        self.specs.insert(id, type_spec);

        Ok(())
    }
}
