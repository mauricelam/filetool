use lazy_static::lazy_static;
use proguard::ProguardMapper;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use wasm_bindgen::prelude::*;

mod opcodes;

lazy_static! {
    static ref PROGUARD_MAPPER: Mutex<Option<ProguardMapper<'static>>> = Mutex::new(None);
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Serialize, Deserialize)]
pub struct JField {
    pub name: String,
    pub type_name: String,
    pub access_flags: String,
    pub is_static: bool,
    pub class_descriptor: String,
    pub class_id: u32,
}

#[wasm_bindgen]
pub fn dex_fields(bytes: Vec<u8>, class_id: u32) -> Result<JsValue, wasm_bindgen::JsError> {
    let v = dex_fields_impl(bytes, class_id).map_err(|e| JsError::new(&format!("{e}")))?;
    Ok(serde_wasm_bindgen::to_value(&v)
        .map_err(|e| JsError::new(&format!("{e}")))?
        .into())
}

fn dex_fields_impl(bytes: Vec<u8>, class_id: u32) -> Result<Vec<JField>, anyhow::Error> {
    let dex = dex::DexReader::from_vec(bytes)?;
    let Some(Ok(class)) = dex.classes().nth(class_id as usize) else {
        return Err(anyhow::anyhow!("Class not found"));
    };

    let class_desc = class.jtype().type_descriptor().to_string();

    let mut out: Vec<JField> = Vec::new();

    for f in class.fields() {
        let mut flags = Vec::new();
        if f.is_public() { flags.push("public"); }
        if f.is_private() { flags.push("private"); }
        if f.is_protected() { flags.push("protected"); }
        if f.is_static() { flags.push("static"); }
        if f.is_final() { flags.push("final"); }
        if f.is_volatile() { flags.push("volatile"); }
        if f.is_transient() { flags.push("transient"); }

        out.push(JField {
            name: f.name().to_string(),
            type_name: f.jtype().to_java_type(),
            access_flags: flags.join(" "),
            is_static: f.is_static(),
            class_descriptor: class_desc.clone(),
            class_id,
        });
    }

    Ok(out)
}

#[wasm_bindgen]
pub fn load_proguard_mapping(mapping: String) {
    let mapping_static: &'static str = Box::leak(mapping.into_boxed_str());
    let mapper = ProguardMapper::from(mapping_static);
    let mut guard = PROGUARD_MAPPER.lock().unwrap();
    *guard = Some(mapper);
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Serialize, Deserialize)]
pub struct JClass {
    pub name: String,
    pub original_name: String,
    pub descriptor: String,
    /// The class ID that the Go side uses, which is the index of the class in the iterator.
    /// Note: This is not the same as class.id()
    pub id: u32,
    /// Space-separated access flags like "public final".
    pub access_flags: String,
    /// Java type name of the superclass, if present.
    pub super_name: Option<String>,
    /// Java type names of implemented interfaces.
    pub interfaces: Vec<String>,
    /// Annotation type names present on the class (e.g., "Lcom/example/Anno;" -> "com.example.Anno").
    pub annotations: Vec<String>,
}

#[wasm_bindgen]
pub fn init_logger() {
    console_log::init_with_level(log::Level::Info).unwrap();
}

#[wasm_bindgen]
pub fn dex_classes(bytes: Vec<u8>) -> Result<JsValue, wasm_bindgen::JsError> {
    let v = dex_classes_impl(bytes).map_err(|e| JsError::new(&format!("{e}")))?;
    Ok(serde_wasm_bindgen::to_value(&v)
        .map_err(|e| JsError::new(&format!("{e}")))?
        .into())
}

fn dex_classes_impl(bytes: Vec<u8>) -> Result<Vec<JClass>, anyhow::Error> {
    let dex = dex::DexReader::from_vec(bytes)?;
    let mapper_guard = PROGUARD_MAPPER.lock().unwrap();
    let mapper = mapper_guard.as_ref();

    let classes = dex
        .classes()
        .enumerate()
        .map(|(i, c)| {
            c.map(|c| {
                let obfuscated_name = c.jtype().to_java_type();
                let original_name = if let Some(mapper) = mapper {
                    mapper
                        .remap_class(&obfuscated_name)
                        .unwrap_or(&obfuscated_name)
                        .to_string()
                } else {
                    obfuscated_name.clone()
                };

                // Class access flags
                let access_flags = {
                    let mut flags: Vec<&str> = Vec::new();
                    if c.is_public() { flags.push("public"); }
                    if c.is_private() { flags.push("private"); }
                    if c.is_protected() { flags.push("protected"); }
                    if c.is_static() { flags.push("static"); }
                    if c.is_final() { flags.push("final"); }
                    if c.is_interface() { flags.push("interface"); }
                    if c.is_abstract() { flags.push("abstract"); }
                    if c.is_synthetic() { flags.push("synthetic"); }
                    if c.is_annotation() { flags.push("annotation"); }
                    if c.is_enum() { flags.push("enum"); }
                    flags.join(" ")
                };

                // Superclass name (java type) if present
                let super_name = c
                    .super_class()
                    .and_then(|sid| dex.get_type(sid).ok())
                    .map(|t| t.to_java_type());

                // Implemented interfaces as java type names
                let interfaces: Vec<String> = c
                    .interfaces()
                    .iter()
                    .map(|t| t.to_java_type())
                    .collect();

                // Class-level annotations: list of annotation type names as java types
                let annotations: Vec<String> = c
                    .annotations()
                    .iter()
                    .map(|ann| ann.jtype().to_java_type())
                    .collect();

                JClass {
                    name: obfuscated_name,
                    original_name,
                    descriptor: c.jtype().type_descriptor().to_string(),
                    id: i as u32,
                    access_flags,
                    super_name,
                    interfaces,
                    annotations,
                }
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(classes)
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Serialize, Deserialize)]
pub struct JMethod {
    pub name: String,
    pub class_descriptor: String,
    pub class_id: u32,
    pub parameters: Vec<String>,
    pub return_type: String,
    pub access_flags: String,
}

#[wasm_bindgen]
pub fn dex_methods(bytes: Vec<u8>, class_id: u32) -> Result<JsValue, wasm_bindgen::JsError> {
    let v = dex_methods_impl(bytes, class_id).map_err(|e| JsError::new(&format!("{e}")))?;
    Ok(serde_wasm_bindgen::to_value(&v)
        .map_err(|e| JsError::new(&format!("{e}")))?
        .into())
}

fn dex_methods_impl(bytes: Vec<u8>, class_id: u32) -> Result<Vec<JMethod>, anyhow::Error> {
    let dex = dex::DexReader::from_vec(bytes)?;
    let Some(Ok(class)) = dex.classes().nth(class_id as usize) else {
        return Err(anyhow::anyhow!("Class not found"));
    };
    let methods = class
        .methods()
        .map(|m| {
            let parameters: Vec<String> = m.params()
                .iter()
                .map(|p| p.to_java_type())
                .collect();
            
            let return_type = m.return_type().to_java_type();
            
            let access_flags = {
                let mut flags = Vec::new();
                if m.is_public() { flags.push("public"); }
                if m.is_private() { flags.push("private"); }
                if m.is_protected() { flags.push("protected"); }
                if m.is_static() { flags.push("static"); }
                if m.is_final() { flags.push("final"); }
                if m.is_synchronized() { flags.push("synchronized"); }
                if m.is_native() { flags.push("native"); }
                if m.is_abstract() { flags.push("abstract"); }
                if m.is_constructor() { flags.push("constructor"); }
                flags.join(" ")
            };
            
            JMethod {
                name: m.name().to_string(),
                class_descriptor: class.jtype().type_descriptor().to_string(),
                class_id: class_id,
                parameters,
                return_type,
                access_flags,
            }
        })
        .collect::<Vec<_>>();
    Ok(methods)
}

#[wasm_bindgen(getter_with_clone)]
#[derive(Serialize, Deserialize)]
pub struct JInstruction {
    pub name: String,
    pub opname: String,
}

#[wasm_bindgen]
pub fn dex_instructions(bytes: Vec<u8>, method: JsValue) -> Result<JsValue, wasm_bindgen::JsError> {
    let method = serde_wasm_bindgen::from_value::<JMethod>(method)?;
    let v = dex_instructions_impl(bytes, method).map_err(|e| JsError::new(&format!("{e}")))?;
    Ok(serde_wasm_bindgen::to_value(&v)
        .map_err(|e| JsError::new(&format!("{e}")))?
        .into())
}

fn dex_instructions_impl(
    bytes: Vec<u8>,
    method: JMethod,
) -> Result<Vec<JInstruction>, anyhow::Error> {
    let dex = dex::DexReader::from_vec(bytes)?;
    let Some(class) = dex.find_class_by_name(&method.class_descriptor)? else {
        return Err(anyhow::anyhow!("Class not found"));
    };
    let method = class
        .methods()
        .filter(|m| m.name().to_string() == method.name)
        .next()
        .unwrap();
    let mut ins_iter = method.code().into_iter().flat_map(|c| c.insns()).copied();
    let mut instructions = Vec::new();
    while let Some(i) = ins_iter.next() {
        let op = i;
        let Some((opname, _format, bit_size)) = opcodes::opcode_to_name((op >> 8) as u8) else {
            continue;
        };
        for _ in 0..(bit_size / 16) - 1 {
            ins_iter.next();
        }
        instructions.push(JInstruction {
            name: op.to_string(),
            opname: opname.to_string(),
        });
    }
    Ok(instructions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_proguard_mapping() {
        let mapping_content = "
com.example.MyClass -> a.b.c:
    int myField -> a
    void myMethod() -> a
com.example.AnotherClass -> a.b.d:
        "
        .to_string();

        load_proguard_mapping(mapping_content);

        let mapper_guard = PROGUARD_MAPPER.lock().unwrap();
        let mapper = mapper_guard.as_ref().unwrap();

        assert_eq!(
            mapper.remap_class("a.b.c"),
            Some("com.example.MyClass")
        );
        assert_eq!(
            mapper.remap_class("a.b.d"),
            Some("com.example.AnotherClass")
        );
        assert_eq!(mapper.remap_class("non.existent"), None);
    }
}
