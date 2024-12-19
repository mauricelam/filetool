#![warn(clippy::unwrap_used)]

mod annotations;
mod class;
mod method;
mod pool;
mod generics;

use annotations::{format_annotation, format_type_annotation};
use class::{
    format_class_type, format_classname, format_type, parse_class_name, parse_method_descriptor,
};
use indenter::indented;
use method::format_method_params;
use noak::{
    reader::{cpool::ConstantPool, Attribute, AttributeContent, Class},
    AccessFlags,
};
use pool::{constant_pool_to_js, IndexToString};

use std::fmt::Write;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(getter_with_clone)]
pub struct ParsedClass {
    pub version_major: u16,
    pub version_minor: u16,
    pub description: String,
    pub constant_pool: JsValue,
}

#[wasm_bindgen]
pub fn parse_classfile(bytes: Vec<u8>) -> Result<ParsedClass, wasm_bindgen::JsError> {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    let _ = console_log::init();

    let class = Class::new(&bytes)?;
    let mut contents = String::new();
    let mut formatter = &mut contents;
    for attr in class.attributes().iter().flatten() {
        format_attr(&mut formatter, &attr, class.pool())?
    }
    let class_name = if let Ok(referenced_class) = class.pool().get(class.this_class()) {
        referenced_class.name.lookup_str(class.pool())
    } else {
        format!("{:?}", class.this_class())
    };
    let (package, class_name) = parse_class_name(&class_name);
    if !package.is_empty() {
        writeln!(formatter, "package {package};")?;
        writeln!(formatter)?;
    }
    let method_access_type = if class.access_flags().contains(AccessFlags::INTERFACE) {
        AccessType::InterfaceMethod
    } else {
        AccessType::Method
    };
    write!(
        formatter,
        "{}{} {class_name}",
        format_access(&class.access_flags(), AccessType::Class),
        format_class_type(&class.access_flags()),
    )?;
    if let Some(superclass) = class.super_class() {
        let super_class = if let Ok(superclass) = class.pool().get(superclass) {
            superclass.name.lookup_str(class.pool())
        } else {
            "<Unknown Super Class>".into()
        };
        let qualified_super_class = format_classname(&super_class, &package);
        write!(formatter, " extends {qualified_super_class}")?;
    }
    writeln!(formatter, " {{")?;
    let mut class_formatter = indented(&mut formatter).with_str("  ");
    for field in class.fields().iter().flatten() {
        for attr in field.attributes().iter().flatten() {
            format_attr(&mut class_formatter, &attr, class.pool())?;
        }
        writeln!(
            class_formatter,
            "{}{} {};",
            format_access(&field.access_flags(), AccessType::Field),
            format_type(&field.descriptor().lookup_str(class.pool()), &package),
            field.name().lookup_str(class.pool()),
        )?;
    }
    writeln!(class_formatter)?;
    for method in class.methods().iter().flatten() {
        let mut has_body = false;
        for attr in method.attributes().iter().flatten() {
            if let Ok(AttributeContent::Code(_)) = attr.read_content(class.pool()) {
                has_body = true;
            }
            format_attr(&mut class_formatter, &attr, class.pool())?;
        }
        let method_descriptor = method.descriptor().lookup_str(class.pool());
        let (args, return_type) = parse_method_descriptor(&method_descriptor, &package);
        let method_name = method.name().lookup_str(class.pool());
        let body = if has_body { " { ... }" } else { ";" };
        let access = format_access(&method.access_flags(), method_access_type);
        if method_name == "<clinit>" {
            writeln!(class_formatter, "static{body}")?;
        } else if method_name == "<init>" {
            writeln!(class_formatter, "{access}{class_name}(")?;
            format_method_params(
                &mut class_formatter,
                method.attributes().into_iter().flatten(),
                &args,
                class.pool(),
            )?;
            writeln!(class_formatter, "){body}")?;
        } else {
            writeln!(class_formatter, "{access}{return_type} {method_name}(")?;
            let mut param_formatter = indented(&mut class_formatter).with_str("  ");
            format_method_params(
                &mut param_formatter,
                method.attributes().into_iter().flatten(),
                &args,
                class.pool(),
            )?;
            writeln!(class_formatter, "){body}")?;
        }
        writeln!(class_formatter)?;
    }
    writeln!(formatter, "}}")?;
    Ok(ParsedClass {
        version_major: class.version().major,
        version_minor: class.version().minor,
        description: contents,
        constant_pool: constant_pool_to_js(class.pool())?,
    })
}

fn format_attr(
    mut write: impl std::fmt::Write,
    attr: &Attribute,
    pool: &ConstantPool,
) -> Result<(), std::fmt::Error> {
    let name = attr.name().lookup_str(pool);
    match attr.read_content(pool) {
        Ok(AttributeContent::AnnotationDefault(annotation_default)) => {
            writeln!(write, "[attr={name}]")?
        }
        Ok(AttributeContent::BootstrapMethods(bootstrap_methods)) => {
            writeln!(write, "[attr={name}]")?
        }
        Ok(AttributeContent::Code(code)) => {}
        Ok(AttributeContent::ConstantValue(constant_value)) => writeln!(write, "[attr={name}]")?,
        Ok(AttributeContent::Deprecated(deprecated)) => writeln!(write, "@Deprecated")?,
        Ok(AttributeContent::EnclosingMethod(enclosing_method)) => {
            writeln!(write, "[attr={name}]")?
        }
        Ok(AttributeContent::Exceptions(exceptions)) => writeln!(write, "[attr={name}]")?,
        Ok(AttributeContent::InnerClasses(inner_classes)) => writeln!(write, "[attr={name}]")?,
        Ok(AttributeContent::LineNumberTable(line_number_table)) => {
            writeln!(write, "[attr={name}]")?
        }
        Ok(AttributeContent::LocalVariableTable(local_variable_table)) => {
            writeln!(write, "[attr={name}]")?
        }
        Ok(AttributeContent::LocalVariableTypeTable(local_variable_type_table)) => {
            writeln!(write, "[attr={name}]")?
        }
        Ok(AttributeContent::MethodParameters(method_parameters)) => {
            // for param in method_parameters.parameters().iter().flatten() {
            //     write!(write, "{}", param.name().lookup_str(pool)).unwrap();
            // }
        }
        Ok(AttributeContent::Module(module)) => writeln!(write, "[attr={name}]")?,
        Ok(AttributeContent::ModuleMainClass(module_main_class)) => {
            writeln!(write, "[attr={name}]")?
        }
        Ok(AttributeContent::ModulePackages(module_packages)) => writeln!(write, "[attr={name}]")?,
        Ok(AttributeContent::NestHost(nest_host)) => writeln!(write, "[attr={name}]")?,
        Ok(AttributeContent::NestMembers(nest_members)) => writeln!(write, "[attr={name}]")?,
        Ok(AttributeContent::PermittedSubclasses(permitted_subclasses)) => {
            writeln!(write, "[attr={name}]")?
        }
        Ok(AttributeContent::Record(record)) => writeln!(write, "[attr={name}]")?,
        Ok(AttributeContent::RuntimeInvisibleAnnotations(runtime_invisible_annotations)) => {
            for annotation in runtime_invisible_annotations.annotations().iter().flatten() {
                writeln!(write, "{}", format_annotation(annotation, pool))?
            }
        }
        Ok(AttributeContent::RuntimeInvisibleParameterAnnotations(_)) => {}
        Ok(AttributeContent::RuntimeInvisibleTypeAnnotations(
            runtime_invisible_type_annotations,
        )) => {
            for annotation in runtime_invisible_type_annotations
                .annotations()
                .iter()
                .flatten()
            {
                writeln!(write, "{}", format_type_annotation(annotation, pool))?
            }
        }
        Ok(AttributeContent::RuntimeVisibleAnnotations(runtime_visible_annotations)) => {
            for annotation in runtime_visible_annotations.annotations().iter().flatten() {
                writeln!(write, "{}", format_annotation(annotation, pool))?
            }
        }
        Ok(AttributeContent::RuntimeVisibleParameterAnnotations(_)) => {}
        Ok(AttributeContent::RuntimeVisibleTypeAnnotations(runtime_visible_type_annotations)) => {
            for annotation in runtime_visible_type_annotations
                .annotations()
                .iter()
                .flatten()
            {
                writeln!(write, "{}", format_type_annotation(annotation, pool)).unwrap();
            }
        }
        Ok(AttributeContent::Signature(signature)) => writeln!(
            write,
            "[attr={name}: {}]",
            signature.signature().lookup_str(pool)
        )?,
        Ok(AttributeContent::SourceDebugExtension(_source_debug_extension)) => {
            writeln!(write, "[attr={name}]")?
        }
        Ok(AttributeContent::SourceFile(source_file)) => writeln!(
            write,
            "{name}: {}",
            source_file.source_file().lookup_str(pool)
        )?,
        Ok(AttributeContent::StackMapTable(_stack_map_table)) => writeln!(write, "[attr={name}]")?,
        Ok(AttributeContent::Synthetic(_synthetic)) => writeln!(write, "[attr={name}]")?,
        Err(e) => writeln!(write, "[attr={name}: Error: {e:?}]")?,
    }
    Ok(())
}

#[derive(PartialEq, Eq, Copy, Clone)]
enum AccessType {
    Class,
    InterfaceMethod,
    Method,
    Field,
}

fn format_access(access_flags: &AccessFlags, access_type: AccessType) -> String {
    let mut string = String::new();
    if access_flags.contains(AccessFlags::PRIVATE) {
        string.push_str("private ");
    }
    if access_flags.contains(AccessFlags::PROTECTED) {
        string.push_str("protected ");
    }
    if access_flags.contains(AccessFlags::PUBLIC) {
        string.push_str("public ");
    }
    if access_flags.contains(AccessFlags::ABSTRACT) {
        if !access_flags.contains(AccessFlags::INTERFACE)
            && access_type != AccessType::InterfaceMethod
        {
            string.push_str("abstract ");
        }
    } else if access_type == AccessType::InterfaceMethod {
        string.push_str("default ");
    }
    if access_flags.contains(AccessFlags::STATIC) {
        string.push_str("static ");
    }
    if access_flags.contains(AccessFlags::FINAL) {
        string.push_str("final ");
    }
    if access_flags.contains(AccessFlags::SYNCHRONIZED) && access_type != AccessType::Class {
        string.push_str("synchronized ");
    }
    if access_flags.contains(AccessFlags::NATIVE) {
        string.push_str("native ");
    }
    if access_flags.contains(AccessFlags::TRANSIENT) {
        string.push_str("transient ");
    }
    if access_flags.contains(AccessFlags::VOLATILE) {
        string.push_str("volatile ");
    }
    if access_flags.contains(AccessFlags::STRICT) {
        string.push_str("strictfp ");
    }
    if access_flags.contains(AccessFlags::BRIDGE) {
        string.push_str("/* bridge */ ");
    }
    if access_flags.contains(AccessFlags::MANDATED) {
        string.push_str("/* mandated */ ");
    }
    if access_flags.contains(AccessFlags::MODULE) {
        string.push_str("/* module */ ");
    }
    if access_flags.contains(AccessFlags::SUPER) {
        string.push_str("/* super */ ");
    }
    if access_flags.contains(AccessFlags::SYNTHETIC) {
        string.push_str("/* synthetic */ ");
    }
    if access_flags.contains(AccessFlags::VARARGS) {
        string.push_str("/* varargs */ ");
    }
    string
}
