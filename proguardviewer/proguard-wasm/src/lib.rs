use wasm_bindgen::prelude::*;
use proguard::{ProguardMapper, StackFrame};
extern crate console_error_panic_hook;
use std::panic;
use regex::Regex;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn get_rules(mapping_file_content: &str) -> Result<String, JsValue> {
    Ok(mapping_file_content.to_string())
}

#[wasm_bindgen]
pub fn deobfuscate_class(mapping_file_content: &str, class_name: &str) -> Result<String, JsValue> {
    let mapper = ProguardMapper::from(mapping_file_content);
    match mapper.remap_class(class_name) {
        Some(remapped) => Ok(remapped.to_string()),
        None => Ok(class_name.to_string()),
    }
}

#[wasm_bindgen]
pub fn deobfuscate_method(mapping_file_content: &str, class_name: &str, method_name: &str) -> Result<String, JsValue> {
    let mapper = ProguardMapper::from(mapping_file_content);
    let frame = StackFrame::new(class_name, method_name, 0);
    let remapped_frames: Vec<_> = mapper.remap_frame(&frame).collect();
    if !remapped_frames.is_empty() {
        Ok(remapped_frames[0].method().to_string())
    } else {
        Ok(method_name.to_string())
    }
}

#[wasm_bindgen]
pub fn deobfuscate(mapping_file_content: &str, stack_trace_str: &str) -> Result<String, JsValue> {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
    let mapper = ProguardMapper::from(mapping_file_content);
    let mut remapped_trace = String::new();

    let re = Regex::new(r"at ([\w\.$]+)\(([\w\s\.]+):(\d+)\)").unwrap();

    for line in stack_trace_str.lines() {
        if let Some(caps) = re.captures(line) {
            let class_and_method = caps.get(1).map_or("", |m| m.as_str());
            let file = caps.get(2).map_or("", |m| m.as_str());
            let line_num = caps.get(3).map_or(0, |m| m.as_str().parse().unwrap_or(0));

            let parts: Vec<&str> = class_and_method.split('.').collect();
            if parts.len() >= 2 {
                let class = parts[..parts.len() - 1].join(".");
                let method = parts[parts.len() - 1];

                let frame = StackFrame::new(&class, method, line_num);
                let remapped_frames: Vec<_> = mapper.remap_frame(&frame).collect();
                if !remapped_frames.is_empty() {
                    let remapped_frame = &remapped_frames[0];
                    let remapped_line = format!("\tat {}.{}({}:{})", remapped_frame.class(), remapped_frame.method(), file, line_num);
                    remapped_trace.push_str(&remapped_line);
                    remapped_trace.push('\n');
                    continue;
                }
            }
        }
        remapped_trace.push_str(line);
        remapped_trace.push('\n');
    }

    Ok(remapped_trace)
}
