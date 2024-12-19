use noak::reader::{cpool::ConstantPool, Attribute, AttributeContent};

use crate::annotations::format_annotation;

pub(crate) fn format_method_params<'a>(
    mut write: impl std::fmt::Write,
    attributes: impl IntoIterator<Item = Attribute<'a>>,
    args: impl IntoIterator<Item = &'a String>,
    pool: &'a ConstantPool,
) -> Result<(), std::fmt::Error> {
    let mut method_params = None;
    let mut runtime_invisible_annotations = None;
    for attr in attributes {
        match attr.read_content(pool) {
            Ok(AttributeContent::MethodParameters(method_parameters)) => {
                method_params = Some(method_parameters);
            }
            Ok(AttributeContent::RuntimeInvisibleParameterAnnotations(annotations)) => {
                runtime_invisible_annotations = Some(annotations);
            }
            Ok(AttributeContent::RuntimeVisibleParameterAnnotations(
                _runtime_visible_parameter_annotations,
            )) => (),
            Ok(_) => (),
            Err(_) => (),
        };
    }
    let mut method_params = method_params.into_iter().flat_map(|p| p.parameters());
    let mut runtime_invisible_annotations = runtime_invisible_annotations
        .into_iter()
        .flat_map(|a| a.parameters());
    for arg in args {
        if let Some(param) = method_params.next() {
            write!(write, "/* MethodParam={param:?} */ ")?;
        }
        if let Some(Ok(annotations)) = runtime_invisible_annotations.next() {
            for annotation in annotations.annotations().into_iter().flatten() {
                write!(write, "{} ", format_annotation(annotation, pool))?;
            }
        }
        writeln!(write, "{arg}, ")?;
    }
    Ok(())
}
