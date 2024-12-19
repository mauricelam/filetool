use std::collections::BTreeMap;

use noak::reader::cpool::{self, ConstantPool, Utf8};
use wasm_bindgen::{JsError, JsValue};

pub fn constant_pool_to_js(pool: &ConstantPool) -> Result<JsValue, JsError> {
    let mut map = BTreeMap::<u16, String>::new();
    for (index, item) in pool.iter_indices() {
        map.insert(index.as_u16(), format!("{item:?}"));
    }
    Ok(serde_wasm_bindgen::to_value(&map)?)
}

pub trait IndexToString {
    fn lookup_str(&self, pool: &ConstantPool) -> String;
}

impl IndexToString for cpool::Index<Utf8<'_>> {
    fn lookup_str(&self, pool: &ConstantPool) -> String {
        if let Ok(s) = pool.get(*self) {
            s.content.display().to_string()
        } else {
            format!("{self:?}")
        }
    }
}
