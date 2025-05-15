use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

mod opcodes;

#[wasm_bindgen(getter_with_clone)]
#[derive(Serialize, Deserialize)]
pub struct JClass {
    pub name: String,
    pub descriptor: String,
    /// The class ID that the Go side uses, which is the index of the class in the iterator.
    /// Note: This is not the same as class.id()
    pub id: u32,
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
    let classes = dex
        .classes()
        .enumerate()
        .map(|(i, c)| {
            c.map(|c| JClass {
                name: c.jtype().to_java_type(),
                descriptor: c.jtype().type_descriptor().to_string(),
                id: i as u32,
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
        .map(|m| JMethod {
            name: m.name().to_string(),
            class_descriptor: class.jtype().type_descriptor().to_string(),
            class_id: class_id,
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
