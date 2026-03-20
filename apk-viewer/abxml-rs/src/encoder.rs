//! Exports the decoded binary XMLs to string XMLs

use std::{io::Write, ops::Deref};

use anyhow::{Error, Context};
use xml::{
    common::XmlVersion,
    writer::{EmitterConfig, EventWriter, XmlEvent},
};

use crate::model::{Element as AbxmlElement, Namespaces};

#[derive(Debug, Copy, Clone)]
pub struct Xml;

impl Xml {
    pub fn encode(namespaces: &Namespaces, elements: &[AbxmlElement]) -> Result<String, Error> {
        let target: Vec<u8> = Vec::new();
        let mut writer = EmitterConfig::new()
            .perform_indent(true)
            .create_writer(target);

        let version = XmlVersion::Version10;
        writer.write(XmlEvent::StartDocument {
            version,
            encoding: None,
            standalone: Some(false),
        })?;

        for element in elements {
            Self::encode_element(&mut writer, namespaces, element)
                .context("error decoding an element")?;
        }

        let inner = writer.into_inner();
        let xml = String::from_utf8(inner).context("could not export XML")?;
        Ok(Self::reformat_attributes(xml))
    }

    fn reformat_attributes(xml: String) -> String {
        let mut result = String::with_capacity(xml.len());
        for line in xml.lines() {
            let trimmed = line.trim_start();
            let indent_len = line.len() - trimmed.len();
            let indent = &line[..indent_len];

            if trimmed.starts_with('<') && !trimmed.starts_with("</") && !trimmed.starts_with("<?") {
                if let Some(first_space_idx) = trimmed.find(' ') {
                    let mut tag_end_idx = trimmed.len();
                    if trimmed.ends_with(" />") {
                        tag_end_idx = trimmed.len() - 3;
                    } else if trimmed.ends_with("/>") {
                        tag_end_idx = trimmed.len() - 2;
                    } else if trimmed.ends_with('>') {
                        tag_end_idx = trimmed.len() - 1;
                    }

                    if tag_end_idx > first_space_idx {
                        let tag_name = &trimmed[1..first_space_idx];
                        let attributes_part = &trimmed[first_space_idx..tag_end_idx];

                        if Self::count_attributes(attributes_part) > 1 {
                            result.push_str(indent);
                            result.push('<');
                            result.push_str(tag_name);

                            let mut in_double_quote = false;
                            let mut in_single_quote = false;
                            let mut last_was_space = false;
                            for c in attributes_part.chars() {
                                if c == '"' && !in_single_quote {
                                    in_double_quote = !in_double_quote;
                                    result.push(c);
                                    last_was_space = false;
                                } else if c == '\'' && !in_double_quote {
                                    in_single_quote = !in_single_quote;
                                    result.push(c);
                                    last_was_space = false;
                                } else if c == ' ' && !in_double_quote && !in_single_quote {
                                    if !last_was_space {
                                        result.push('\n');
                                        result.push_str(indent);
                                        result.push_str("    ");
                                    }
                                    last_was_space = true;
                                } else {
                                    result.push(c);
                                    last_was_space = false;
                                }
                            }

                            let closing = &trimmed[tag_end_idx..];
                            result.push_str(closing);
                            result.push('\n');
                            continue;
                        }
                    }
                }
            }
            result.push_str(line);
            result.push('\n');
        }
        result
    }

    fn count_attributes(part: &str) -> usize {
        let mut count = 0;
        let mut in_double_quote = false;
        let mut in_single_quote = false;
        let mut last_was_space = true;
        for c in part.chars() {
            if c == '"' && !in_single_quote {
                in_double_quote = !in_double_quote;
            } else if c == '\'' && !in_double_quote {
                in_single_quote = !in_single_quote;
            } else if !in_double_quote && !in_single_quote {
                if c == ' ' {
                    last_was_space = true;
                } else if last_was_space {
                    count += 1;
                    last_was_space = false;
                }
            }
        }
        count
    }

    fn encode_element<W: Write>(
        writer: &mut EventWriter<W>,
        namespaces: &Namespaces,
        element: &AbxmlElement,
    ) -> Result<(), Error> {
        let tag = element.get_tag();
        let tag_name = tag.get_name();

        if tag_name.as_str() == "" {
            for child in element.get_children() {
                Self::encode_element(writer, namespaces, child)?;
            }
            return Ok(());
        }

        let prefixes = tag.get_prefixes();
        let mut xml_element = XmlEvent::start_element(tag_name.deref().as_str());

        for (k, v) in element.get_attributes() {
            xml_element = xml_element.attr(k.as_str(), v);
        }

        for uri in prefixes {
            let prefix = namespaces.get(&uri.deref().clone());
            if let Some(p) = prefix {
                xml_element = xml_element.ns(p.as_str(), uri.as_str());
            }
        }

        writer.write(xml_element)?;

        for child in element.get_children() {
            Self::encode_element(writer, namespaces, child)?;
        }

        writer.write(XmlEvent::end_element())?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Element, Tag, Namespaces};
    use std::collections::HashMap;
    use std::rc::Rc;

    #[test]
    fn test_xml_encoding_with_multiple_attributes() {
        let mut attrs = HashMap::new();
        attrs.insert("attr1".to_string(), "value1".to_string());
        attrs.insert("attr2".to_string(), "value with spaces".to_string());

        let tag = Tag::new(Rc::new("root".to_string()), vec![]);
        let element = Element::new(tag, attrs);

        let namespaces = Namespaces::new();
        let xml = Xml::encode(&namespaces, &[element]).unwrap();

        println!("Generated XML:\n{}", xml);
        assert!(xml.contains("\n    attr1=\"value1\"") || xml.contains("\n    attr2=\"value with spaces\""));
    }

    #[test]
    fn test_xml_encoding_with_single_attribute() {
        let mut attrs = HashMap::new();
        attrs.insert("attr1".to_string(), "value1".to_string());

        let tag = Tag::new(Rc::new("root".to_string()), vec![]);
        let element = Element::new(tag, attrs);

        let namespaces = Namespaces::new();
        let xml = Xml::encode(&namespaces, &[element]).unwrap();

        println!("Generated XML:\n{}", xml);
        assert!(xml.contains("<root attr1=\"value1\" />"));
    }

    #[test]
    fn test_xml_encoding_with_namespaces() {
        let mut attrs = HashMap::new();
        attrs.insert("android:name".to_string(), "com.example".to_string());

        let tag = Tag::new(Rc::new("manifest".to_string()), vec![Rc::new("http://schemas.android.com/apk/res/android".to_string())]);
        let element = Element::new(tag, attrs);

        let mut namespaces = Namespaces::new();
        namespaces.insert("http://schemas.android.com/apk/res/android".to_string(), "android".to_string());

        let xml = Xml::encode(&namespaces, &[element]).unwrap();

        println!("Generated XML:\n{}", xml);
        assert!(xml.contains("xmlns:android=\"http://schemas.android.com/apk/res/android\""));
        assert!(xml.contains("\n    android:name=\"com.example\""));
    }
}
