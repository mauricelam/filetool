use abxml::model::builder::Xml;
use abxml::model::owned::{StringTableBuf, XmlTagEndBuf, XmlTagStartBuf, Encoding};
use std::io::Write;

fn main() {
    let mut xml = Xml::default();

    let mut st_buf = StringTableBuf::default();
    st_buf.add_string("tag1".to_string());
    st_buf.add_string("tag2".to_string());
    xml.push_owned(Box::new(st_buf));

    // <tag1 />
    xml.push_owned(Box::new(XmlTagStartBuf::new(0, 0, 0xFFFF_FFFF, 0, 0, 0xFFFF_FFFF)));
    xml.push_owned(Box::new(XmlTagEndBuf::new(0)));

    // <tag2 />
    xml.push_owned(Box::new(XmlTagStartBuf::new(0, 0, 0xFFFF_FFFF, 1, 0, 0xFFFF_FFFF)));
    xml.push_owned(Box::new(XmlTagEndBuf::new(1)));

    let bytes = xml.into_vec().unwrap();
    std::io::stdout().write_all(&bytes).unwrap();
}
