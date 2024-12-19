use noak::reader::{
    attributes::annotations::{Annotation, ElementValue, ElementValuePair, TypeAnnotation},
    cpool::ConstantPool,
    DecodeMany,
};

use crate::{class::format_type, pool::IndexToString};

pub(crate) fn format_annotation(annotation: Annotation, pool: &ConstantPool) -> String {
    let annotation_type = format_type(&annotation.type_().lookup_str(pool), "");
    format!(
        "@{annotation_type}{}",
        format_annotation_params(annotation.pairs(), pool)
    )
}

pub(crate) fn format_type_annotation(annotation: TypeAnnotation, pool: &ConstantPool) -> String {
    let annotation_type = format_type(&annotation.type_().lookup_str(pool), "");
    format!(
        "@{annotation_type}{}",
        format_annotation_params(annotation.pairs(), pool)
    )
}

pub(crate) fn format_annotation_params(
    params: DecodeMany<ElementValuePair, u16>,
    pool: &ConstantPool,
) -> String {
    pub(crate) fn format_element_value(value: ElementValue, pool: &ConstantPool) -> String {
        match value {
            ElementValue::Boolean(index) => match pool.get(index) {
                Ok(value) => value.value.to_string(),
                Err(e) => format!("{e:?}"),
            },
            ElementValue::Byte(index) => match pool.get(index) {
                Ok(value) => value.value.to_string(),
                Err(e) => format!("{e:?}"),
            },
            ElementValue::Short(index) => match pool.get(index) {
                Ok(value) => value.value.to_string(),
                Err(e) => format!("{e:?}"),
            },
            ElementValue::Int(index) => match pool.get(index) {
                Ok(value) => value.value.to_string(),
                Err(e) => format!("{e:?}"),
            },
            ElementValue::Long(index) => match pool.get(index) {
                Ok(value) => value.value.to_string(),
                Err(e) => format!("{e:?}"),
            },
            ElementValue::Float(index) => match pool.get(index) {
                Ok(value) => value.value.to_string(),
                Err(e) => format!("{e:?}"),
            },
            ElementValue::Double(index) => match pool.get(index) {
                Ok(value) => value.value.to_string(),
                Err(e) => format!("{e:?}"),
            },
            ElementValue::Char(index) => match pool.get(index) {
                Ok(value) => value.value.to_string(),
                Err(e) => format!("'{e:?}'"),
            },
            ElementValue::String(index) => match pool.get(index) {
                Ok(value) => match String::from_utf8(value.content.as_bytes().to_vec()) {
                    Ok(s) => format!("\"{s}\""),
                    Err(_) => hex::encode(value.content.as_bytes()),
                },
                Err(e) => format!("\"{e:?}\""),
            },
            ElementValue::Class(index) => match pool.get(index) {
                Ok(value) => format_type(&value.content.display().to_string(), ""),
                Err(e) => format!("{e:?}.class"),
            },
            ElementValue::Enum {
                type_name,
                const_name,
            } => {
                let type_formatted = match pool.get(type_name) {
                    Ok(value) => format_type(&value.content.display().to_string(), ""),
                    Err(e) => format!("{e:?}"),
                };
                let const_formatted = match pool.get(const_name) {
                    Ok(value) => value.content.display().to_string(),
                    Err(e) => format!("{e:?}"),
                };
                format!("{type_formatted}.{const_formatted}")
            }
            ElementValue::Annotation(annotation) => format_annotation(annotation, pool),
            ElementValue::Array(decode_many) => {
                format!(
                    "{{{}}}",
                    decode_many
                        .iter()
                        .flatten()
                        .map(|v| format_element_value(v, pool))
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            }
        }
    }

    let args: Vec<_> = params
        .iter()
        .flatten()
        .map(|pair| {
            format!(
                "{}={}",
                pair.name().lookup_str(pool),
                format_element_value(pair.value(), pool)
            )
        })
        .collect();
    if args.is_empty() {
        String::new()
    } else {
        format!("({})", args.join(", "))
    }
}
