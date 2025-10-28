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
pub fn deobfuscate_class(mapping_file_content: &str, name: &str) -> Result<String, JsValue> {
    let mapper = ProguardMapper::from(mapping_file_content);

    // First, try to remap as a class name directly.
    if let Some(remapped) = mapper.remap_class(name) {
        return Ok(remapped.to_string());
    }

    // If that fails, try to parse it as `class.method`.
    if let Some(last_dot) = name.rfind('.') {
        let (class_name, method_name) = name.split_at(last_dot);
        let method_name = &method_name[1..]; // remove the dot

        if !class_name.is_empty() && !method_name.is_empty() {
            if let Some(remapped_class) = mapper.remap_class(class_name) {
                let frame = StackFrame::new(class_name, method_name, 0);
                let remapped_frames: Vec<_> = mapper.remap_frame(&frame).collect();

                if !remapped_frames.is_empty() {
                    let remapped_frame = &remapped_frames[0];
                    return Ok(format!("{}.{}", remapped_class, remapped_frame.method()));
                }
            }
        }
    }

    // If nothing worked, return the original name.
    Ok(name.to_string())
}

#[wasm_bindgen]
pub fn deobfuscate_stack_trace(mapping_file_content: &str, stack_trace_str: &str) -> Result<String, JsValue> {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
    let mapper = ProguardMapper::from(mapping_file_content);
    let mut remapped_trace = String::new();

    let re = Regex::new(r"at ([\w\.$]+)\(([\w\s\.]+):(\d+)\)").unwrap();

    for line in stack_trace_str.lines() {
        if let Some(caps) = re.captures(line) {
            let class_and_method = caps.get(1).map_or("", |m| m.as_str());
            let file = caps.get(2).map_or("", |m| m.as_str());
            let line_num: usize = caps.get(3).map_or(0, |m| m.as_str().parse().unwrap_or(0));

            let parts: Vec<&str> = class_and_method.split('.').collect();
            if parts.len() >= 2 {
                let class = parts[..parts.len() - 1].join(".");
                let method = parts[parts.len() - 1];

                let frame = StackFrame::new(&class, method, line_num);
                let remapped_frames: Vec<_> = mapper.remap_frame(&frame).collect();
                if !remapped_frames.is_empty() {
                    let remapped_frame = &remapped_frames[0];
                    let remapped_class = mapper.remap_class(&class).unwrap_or(&class);
                    let remapped_line = format!("\tat {}.{}({}:{})", remapped_class, remapped_frame.method(), file, remapped_frame.line());
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

#[cfg(test)]
mod tests {
    use super::*;

    const MAPPING_WITHOUT_LINES: &str = r#"
com.example.MyClass -> a.b.c:
    void myMethod(int) -> b
com.example.AnotherClass -> d.e.f:
    void anotherMethod(java.lang.String) -> d
"#;

    const MAPPING_WITH_LINES: &str = r#"
com.example.MyClass -> a.b.c:
    1:1:void myMethod(int):10:10 -> b
com.example.AnotherClass -> d.e.f:
    1:1:void anotherMethod(java.lang.String):20:20 -> d
"#;

    #[test]
    fn test_remap_class() {
        let remapped = deobfuscate_class(MAPPING_WITHOUT_LINES, "a.b.c").unwrap();
        assert_eq!(remapped, "com.example.MyClass");
    }

    #[test]
    fn test_remap_method() {
        let remapped = deobfuscate_class(MAPPING_WITHOUT_LINES, "a.b.c.b").unwrap();
        assert_eq!(remapped, "com.example.MyClass.myMethod");
    }

    #[test]
    fn test_remap_stack_trace() {
        let stack_trace = r#"
at a.b.c.b(MyClass.java:1)
at d.e.f.d(AnotherClass.java:1)
"#;
        let expected = r#"
	at com.example.MyClass.myMethod(MyClass.java:10)
	at com.example.AnotherClass.anotherMethod(AnotherClass.java:20)
"#;
        let remapped = deobfuscate_stack_trace(MAPPING_WITH_LINES, stack_trace).unwrap();
        assert_eq!(remapped.trim(), expected.trim());
    }
}