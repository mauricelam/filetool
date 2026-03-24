use wasm_bindgen::prelude::*;
use jvm_hprof::{parse_hprof, RecordTag, IdSize, Id};
use jvm_hprof::heap_dump::{SubRecord, FieldType};
use serde::{Serialize, Deserialize};
use std::convert::TryInto;
use std::collections::HashMap;

mod normalize;
use normalize::normalize_hprof;

#[wasm_bindgen]
pub struct HprofParser {
    data: Vec<u8>,
    record_offsets: Vec<usize>,
    metadata: Vec<RecordInfo>,
    id_size: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HprofHeader {
    pub label: String,
    pub id_size: u32,
    pub timestamp_millis: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecordInfo {
    pub index: usize,
    pub tag: String,
    pub micros_since_header_ts: u32,
}

#[derive(Serialize, Deserialize)]
pub struct HeapSummaryEntry {
    pub tag: String,
    pub count: usize,
}

#[derive(Serialize, Deserialize)]
pub struct SearchResult {
    pub total_count: usize,
    pub records: Vec<RecordInfo>,
}

#[derive(Serialize, Deserialize)]
pub struct InstanceCountEntry {
    pub class_name: String,
    pub count: usize,
    pub total_size: usize,
}

#[wasm_bindgen]
impl HprofParser {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<u8>) -> Self {
        std::panic::set_hook(Box::new(console_error_panic_hook::hook));

        let data = normalize_hprof(&data);
        let mut record_offsets = Vec::new();
        let mut metadata = Vec::new();
        let mut id_size = 4;

        if let Ok(hprof) = parse_hprof(&data) {
            id_size = match hprof.header().id_size() { IdSize::U32 => 4, IdSize::U64 => 8 };
            let mut pos = 0;
            while pos < data.len() && data[pos] != 0 { pos += 1; }
            pos += 13;
            let header_len = pos;

            let mut curr = header_len;
            let mut index = 0;
            while curr + 9 <= data.len() {
                record_offsets.push(curr);
                let tag_byte = data[curr];
                let tag_name = match tag_byte {
                    0x01 => "Utf8", 0x02 => "LoadClass", 0x03 => "UnloadClass",
                    0x04 => "StackFrame", 0x05 => "StackTrace", 0x06 => "AllocSites",
                    0x07 => "HeapSummary", 0x0A => "StartThread", 0x0B => "EndThread",
                    0x0C => "HeapDump", 0x1C => "HeapDumpSegment", 0x2C => "HeapDumpEnd",
                    0x0D => "CpuSamples", 0x0E => "ControlSettings", _ => "Unknown",
                };
                let micros = u32::from_be_bytes(data[curr+1..curr+5].try_into().unwrap_or([0; 4]));
                let length = u32::from_be_bytes(data[curr+5..curr+9].try_into().unwrap_or([0; 4])) as usize;
                metadata.push(RecordInfo { index, tag: tag_name.to_string(), micros_since_header_ts: micros });
                curr += 9 + length;
                index += 1;
            }
        }
        HprofParser { data, record_offsets, metadata, id_size }
    }

    pub fn get_header(&self) -> Result<JsValue, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let header = hprof.header();
        let info = HprofHeader {
            label: header.label().unwrap_or("<Invalid UTF-8>").to_string(),
            id_size: match header.id_size() { IdSize::U32 => 4, IdSize::U64 => 8 },
            timestamp_millis: header.timestamp_millis(),
        };
        Ok(serde_wasm_bindgen::to_value(&info)?)
    }

    pub fn get_total_records(&self) -> usize { self.metadata.len() }

    pub fn search_records(&self, query: String, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
        let query_lower = query.to_lowercase();
        let filtered: Vec<_> = self.metadata.iter()
            .filter(|r| query_lower.is_empty() || r.tag.to_lowercase().contains(&query_lower))
            .collect();
        let total_count = filtered.len();
        let start = offset.min(total_count);
        let end = (offset + limit).min(total_count);
        let records: Vec<RecordInfo> = filtered[start..end].iter().map(|&&ref r| r.clone()).collect();
        let result = SearchResult { total_count, records };
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    pub fn get_record_detail(&self, index: usize) -> Result<JsValue, JsValue> {
        let offset = *self.record_offsets.get(index).ok_or_else(|| JsValue::from_str("Record index out of bounds"))?;
        let length = u32::from_be_bytes(self.data[offset + 5..offset + 9].try_into().map_err(|_| "Invalid offset data")?) as usize;
        let tag = self.data[offset];
        let mut detail = format!("Record Tag: {}", self.metadata[index].tag);
        if tag == 0x01 {
             if let Ok(s) = std::str::from_utf8(&self.data[offset+9+(self.id_size as usize)..offset+9+length]) { detail = format!("Utf8: {}", s); }
        }
        Ok(JsValue::from_str(&detail))
    }

    pub fn get_heap_dump_summary(&self, index: usize) -> Result<JsValue, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let record = hprof.records_iter().nth(index).ok_or("No record")?
            .map_err(|e| JsValue::from_str(&format!("Error getting record: {:?}", e)))?;
        let tag = record.tag();
        if tag == RecordTag::HeapDump || tag == RecordTag::HeapDumpSegment {
            let segment = record.as_heap_dump_segment().ok_or("Expected heap dump segment")?
                .map_err(|e| JsValue::from_str(&format!("Error parsing segment: {:?}", e)))?;
            let mut counts = HashMap::new();
            for sub in segment.sub_records() {
                if let Ok(s) = sub {
                    let name = match s {
                        SubRecord::Class(_) => "Class",
                        SubRecord::Instance(_) => "Instance",
                        SubRecord::ObjectArray(_) => "ObjectArray",
                        SubRecord::PrimitiveArray(_) => "PrimitiveArray",
                        _ => "Other",
                    };
                    *counts.entry(name.to_string()).or_insert(0) += 1;
                }
            }
            let mut summary: Vec<HeapSummaryEntry> = counts.into_iter().map(|(tag, count)| HeapSummaryEntry { tag, count }).collect();
            summary.sort_by(|a, b| b.count.cmp(&a.count));
            Ok(serde_wasm_bindgen::to_value(&summary)?)
        } else { Err(JsValue::from_str("Record is not a heap dump")) }
    }

    pub fn get_heap_dump_records(&self, index: usize, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let record = hprof.records_iter().nth(index).ok_or("No record")?
            .map_err(|e| JsValue::from_str(&format!("Error getting record: {:?}", e)))?;
        let id_size = hprof.header().id_size();
        let tag = record.tag();
        if tag == RecordTag::HeapDump || tag == RecordTag::HeapDumpSegment {
            let segment = record.as_heap_dump_segment().ok_or("Expected heap dump segment")?
                .map_err(|e| JsValue::from_str(&format!("Error parsing segment: {:?}", e)))?;
            let mut results = Vec::new();
            for sub in segment.sub_records().skip(offset).take(limit) {
                if let Ok(s) = sub {
                    let desc = match s {
                        SubRecord::Class(c) => format!("Class ID: {:?}, Super: {:?}, Instance Size: {}", c.obj_id(), c.super_class_obj_id(), c.instance_size_bytes()),
                        SubRecord::Instance(i) => format!("Instance ID: {:?}, Class ID: {:?}", i.obj_id(), i.class_obj_id()),
                        SubRecord::ObjectArray(a) => format!("Object Array ID: {:?}, Class ID: {:?}, Length: {}", a.obj_id(), a.array_class_obj_id(), a.elements(id_size).count()),
                        SubRecord::PrimitiveArray(a) => format!("Primitive Array ID: {:?}", a.obj_id()),
                        SubRecord::GcRootUnknown(r) => format!("Root Unknown: {:?}", r.obj_id()),
                        SubRecord::GcRootThreadObj(r) => format!("Root Thread Object: Thread Serial: {}, Stack Depth: {}", r.thread_serial(), r.stack_trace_serial()),
                        _ => format!("{:?}", s),
                    };
                    results.push(desc);
                }
            }
            Ok(serde_wasm_bindgen::to_value(&results)?)
        } else { Err(JsValue::from_str("Record is not a heap dump")) }
    }

    pub fn get_instance_counts(&self) -> Result<JsValue, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let mut utf8_map = HashMap::new();
        let mut class_id_to_name_id = HashMap::new();
        let mut class_id_to_instance_size = HashMap::new();
        let mut instance_counts = HashMap::new();
        let mut total_sizes = HashMap::new();
        let id_size = hprof.header().id_size();
        let element_size = match id_size { IdSize::U32 => 4, IdSize::U64 => 8 };

        for record in hprof.records_iter() {
            let record = match record { Ok(r) => r, Err(_) => continue };
            match record.tag() {
                RecordTag::Utf8 => if let Some(Ok(u)) = record.as_utf_8() {
                    if let Ok(s) = u.text_as_str() { utf8_map.insert(u.name_id(), s.to_string()); }
                },
                RecordTag::LoadClass => if let Some(Ok(l)) = record.as_load_class() {
                    class_id_to_name_id.insert(l.class_obj_id(), l.class_name_id());
                },
                RecordTag::HeapDump | RecordTag::HeapDumpSegment => if let Some(res) = record.as_heap_dump_segment() {
                    if let Ok(seg) = res {
                    for sub in seg.sub_records() {
                        if let Ok(s) = sub {
                            match s {
                                jvm_hprof::heap_dump::SubRecord::Class(c) => { class_id_to_instance_size.insert(c.obj_id(), c.instance_size_bytes() as usize); }
                                jvm_hprof::heap_dump::SubRecord::Instance(i) => { *instance_counts.entry(i.class_obj_id()).or_insert(0) += 1; }
                                jvm_hprof::heap_dump::SubRecord::ObjectArray(a) => {
                                    *instance_counts.entry(a.array_class_obj_id()).or_insert(0) += 1;
                                    *total_sizes.entry(a.array_class_obj_id()).or_insert(0) += a.elements(id_size).count() * element_size;
                                }
                                _ => {}
                            }
                        }
                    }
                    }
                },
                _ => {}
            }
        }

        let mut result = Vec::new();
        for (cid, count) in instance_counts {
            let name = class_id_to_name_id.get(&cid).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{:?}", cid));
            let mut size = total_sizes.get(&cid).cloned().unwrap_or(0);
            if let Some(&isize) = class_id_to_instance_size.get(&cid) { size += count * isize; }
            result.push(InstanceCountEntry { class_name: name, count, total_size: size });
        }
        result.sort_by(|a, b| b.total_size.cmp(&a.total_size));
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    pub fn get_class_reference_graph(&self, min_edge_count: usize) -> Result<String, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let mut utf8_map = HashMap::new();
        let mut class_id_to_name_id = HashMap::new();
        let mut obj_id_to_class_id = HashMap::new();
        let mut class_total_sizes: HashMap<Id, usize> = HashMap::new();

        let mut class_id_to_super_id = HashMap::new();
        let mut class_id_to_instance_size = HashMap::new();
        let mut class_id_to_static_fields = HashMap::new();
        let mut class_id_to_instance_fields = HashMap::new();
        let mut all_class_fields = HashMap::new();

        let id_size = hprof.header().id_size();
        let id_bytes = match id_size { IdSize::U32 => 4, IdSize::U64 => 8 };

        for record in hprof.records_iter() {
            let record = match record { Ok(r) => r, Err(_) => continue };
            match record.tag() {
                RecordTag::Utf8 => if let Some(Ok(u)) = record.as_utf_8() {
                    if let Ok(s) = u.text_as_str() { utf8_map.insert(u.name_id(), s.to_string()); }
                },
                RecordTag::LoadClass => if let Some(Ok(l)) = record.as_load_class() {
                    class_id_to_name_id.insert(l.class_obj_id(), l.class_name_id());
                },
                RecordTag::HeapDump | RecordTag::HeapDumpSegment => if let Some(Ok(seg)) = record.as_heap_dump_segment() {
                    for sub in seg.sub_records() {
                        if let Ok(s) = sub {
                            match s {
                                jvm_hprof::heap_dump::SubRecord::Class(c) => {
                                    let cid = c.obj_id();
                                    class_total_sizes.entry(cid).or_insert(0);
                                    class_id_to_instance_size.insert(cid, c.instance_size_bytes());
                                    if let Some(sid) = c.super_class_obj_id() {
                                        class_id_to_super_id.insert(cid, sid);
                                    }

                                    let mut statics = Vec::new();
                                    for sf in c.static_fields() {
                                        if let Ok(sf) = sf {
                                            let name = utf8_map.get(&sf.name_id()).cloned().unwrap_or_else(|| format!("?{:?}", sf.name_id()));
                                            statics.push((name, format!("{:?}", sf.value())));
                                        }
                                    }
                                    class_id_to_static_fields.insert(cid, statics);

                                    let mut instances = Vec::new();
                                    let mut field_types = Vec::new();
                                    for ifd in c.instance_field_descriptors() {
                                        if let Ok(ifd) = ifd {
                                            let name = utf8_map.get(&ifd.name_id()).cloned().unwrap_or_else(|| format!("?{:?}", ifd.name_id()));
                                            let ftype = ifd.field_type();
                                            instances.push((name, format!("{:?}", ftype)));
                                            field_types.push(ftype);
                                        }
                                    }
                                    class_id_to_instance_fields.insert(cid, instances);
                                    all_class_fields.insert(cid, field_types);
                                }
                                jvm_hprof::heap_dump::SubRecord::Instance(i) => { obj_id_to_class_id.insert(i.obj_id(), i.class_obj_id()); }
                                jvm_hprof::heap_dump::SubRecord::ObjectArray(a) => { obj_id_to_class_id.insert(a.obj_id(), a.array_class_obj_id()); }
                                _ => {}
                            }
                        }
                    }
                },
                _ => {}
            }
        }

        let mut class_refs: HashMap<(Id, Id), usize> = HashMap::new();
        for record in hprof.records_iter() {
            let record = match record { Ok(r) => r, Err(_) => continue };
            if let Some(Ok(seg)) = record.as_heap_dump_segment() {
                for sub in seg.sub_records() {
                    if let Ok(s) = sub {
                        match s {
                            jvm_hprof::heap_dump::SubRecord::Instance(i) => {
                                let scid = i.class_obj_id();
                                let isize = class_id_to_instance_size.get(&scid).cloned().unwrap_or(0);
                                *class_total_sizes.entry(scid).or_insert(0) += isize as usize;
                                *class_total_sizes.entry(i.obj_id()).or_insert(0) += 0; // ensure class exists

                                // Record references from this instance's fields
                                let mut curr_cid = Some(scid);
                                let mut data_offset = 0;
                                let data = i.fields();
                                while let Some(cid) = curr_cid {
                                    if let Some(fields) = all_class_fields.get(&cid) {
                                        for &ftype in fields {
                                            if matches!(ftype, FieldType::ObjectId) {
                                                if data_offset + id_bytes <= data.len() {
                                                    let ref_id_val = match id_size {
                                                        IdSize::U32 => u32::from_be_bytes(data[data_offset..data_offset+4].try_into().unwrap()) as u64,
                                                        IdSize::U64 => u64::from_be_bytes(data[data_offset..data_offset+8].try_into().unwrap()),
                                                    };
                                                    if ref_id_val != 0 {
                                                        let ref_id = Id::from(ref_id_val);
                                                        if let Some(&tcid) = obj_id_to_class_id.get(&ref_id) {
                                                            *class_refs.entry((scid, tcid)).or_insert(0) += 1;
                                                        }
                                                    }
                                                }
                                            }
                                            data_offset += val_size(ftype as u8, id_bytes);
                                        }
                                    }
                                    curr_cid = class_id_to_super_id.get(&cid).cloned();
                                }
                            }
                            jvm_hprof::heap_dump::SubRecord::ObjectArray(a) => {
                                let scid = a.array_class_obj_id();
                                let size = a.elements(id_size).count() * id_bytes;
                                *class_total_sizes.entry(scid).or_insert(0) += size;
                                for elem in a.elements(id_size) {
                                    if let Ok(Some(tid)) = elem {
                                        if let Some(&tcid) = obj_id_to_class_id.get(&tid) {
                                            *class_refs.entry((scid, tcid)).or_insert(0) += 1;
                                        }
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        let mut dot = String::from("digraph G {\n  rankdir=LR;\n  node [shape=none, margin=0];\n");
        let max_s = *class_total_sizes.values().max().unwrap_or(&1) as f64;
        let max_r = *class_refs.values().max().unwrap_or(&1) as f64;

        for (&cid, &size) in &class_total_sizes {
            let name = class_id_to_name_id.get(&cid).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{:?}", cid));
            if size < (max_s * 0.05) as usize && class_total_sizes.len() > 20 && name != "java.lang.Object" { continue; }

            let mut label = format!(r##"<table border="0" cellborder="1" cellspacing="0">
  <tr><td colspan="2" bgcolor="#eeeeee"><b>{} ({:?})</b></td></tr>"##, name, cid);

            if let Some(&sid) = class_id_to_super_id.get(&cid) {
                label.push_str(&format!("  <tr><td colspan=\"2\">Superclass: {:?}</td></tr>", sid));
            }
            if let Some(&isize) = class_id_to_instance_size.get(&cid) {
                label.push_str(&format!("  <tr><td>Instance size (bytes)</td><td>{}</td></tr>", isize));
            }

            if let Some(statics) = class_id_to_static_fields.get(&cid) {
                if !statics.is_empty() {
                    label.push_str("  <tr><td colspan=\"2\" bgcolor=\"#f9f9f9\">Static fields</td></tr>");
                    for (f_name, f_val) in statics {
                        label.push_str(&format!("  <tr><td>{}</td><td>{}</td></tr>", f_name, f_val.replace("<", "&lt;").replace(">", "&gt;")));
                    }
                }
            }

            if let Some(instances) = class_id_to_instance_fields.get(&cid) {
                if !instances.is_empty() {
                    label.push_str("  <tr><td colspan=\"2\" bgcolor=\"#f9f9f9\">Instance field descriptors</td></tr>");
                    for (f_name, f_type) in instances {
                        label.push_str(&format!("  <tr><td>{}</td><td>{}</td></tr>", f_name, f_type));
                    }
                }
            }

            if name.starts_with("[") {
                label.push_str("  <tr><td colspan=\"2\">(array contents)</td></tr>");
            }

            label.push_str("</table>");

            dot.push_str(&format!("  \"{:?}\" [label=<{}>];\n", cid, label));
        }

        for (&(src, tgt), &count) in &class_refs {
            if count < min_edge_count { continue; }
            if class_total_sizes.contains_key(&src) && class_total_sizes.contains_key(&tgt) {
                let pen = 1.0 + (count as f64 / max_r * 8.0).min(8.0);
                dot.push_str(&format!("  \"{:?}\" -> \"{:?}\" [penwidth={}, label=\"x{}\"];\n", src, tgt, pen, count));
            }
        }
        dot.push_str("}\n");
        Ok(dot)
    }

    pub fn get_class_hierarchy(&self) -> Result<String, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let mut utf8_map = HashMap::new();
        let mut class_id_to_name_id = HashMap::new();
        let mut class_id_to_super_id = HashMap::new();

        for record in hprof.records_iter() {
            let record = match record { Ok(r) => r, Err(_) => continue };
            match record.tag() {
                RecordTag::Utf8 => if let Some(Ok(u)) = record.as_utf_8() {
                    if let Ok(s) = u.text_as_str() { utf8_map.insert(u.name_id(), s.to_string()); }
                },
                RecordTag::LoadClass => if let Some(Ok(l)) = record.as_load_class() {
                    class_id_to_name_id.insert(l.class_obj_id(), l.class_name_id());
                },
                RecordTag::HeapDump | RecordTag::HeapDumpSegment => if let Some(Ok(seg)) = record.as_heap_dump_segment() {
                    for sub in seg.sub_records() {
                        if let Ok(jvm_hprof::heap_dump::SubRecord::Class(c)) = sub {
                             if let Some(super_id) = c.super_class_obj_id() {
                                 class_id_to_super_id.insert(c.obj_id(), super_id);
                             }
                        }
                    }
                },
                _ => {}
            }
        }
        let mut dot = String::from("digraph Hierarchy {\n  node [shape=box];\n");
        for (cid, sid) in class_id_to_super_id {
            let cname = class_id_to_name_id.get(&cid).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{:?}", cid));
            let sname = class_id_to_name_id.get(&sid).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{:?}", sid));
            dot.push_str(&format!("  \"{}\" -> \"{}\";\n", cname, sname));
        }
        dot.push_str("}\n");
        Ok(dot)
    }

    pub fn get_all_instances(&self, limit: usize) -> Result<JsValue, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let mut utf8_map = HashMap::new();
        let mut class_id_to_name_id = HashMap::new();

        // Pass 1: Collect UTF-8 strings and class mappings
        for record in hprof.records_iter() {
            let record = match record { Ok(r) => r, Err(_) => continue };
            match record.tag() {
                RecordTag::Utf8 => if let Some(Ok(u)) = record.as_utf_8() {
                    if let Ok(s) = u.text_as_str() { utf8_map.insert(u.name_id(), s.to_string()); }
                },
                RecordTag::LoadClass => if let Some(Ok(l)) = record.as_load_class() {
                    class_id_to_name_id.insert(l.class_obj_id(), l.class_name_id());
                },
                _ => {}
            }
        }

        let mut instances = Vec::new();
        for record in hprof.records_iter() {
            let record = match record { Ok(r) => r, Err(_) => continue };
            if let Some(Ok(seg)) = record.as_heap_dump_segment() {
                for sub in seg.sub_records() {
                    if let Ok(sub) = sub {
                        match sub {
                            SubRecord::Instance(i) => {
                                let name = class_id_to_name_id.get(&i.class_obj_id()).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{:?}", i.class_obj_id()));
                                instances.push(format!("ID: {:?}, Class: {}", i.obj_id(), name));
                            }
                            SubRecord::ObjectArray(a) => {
                                let name = class_id_to_name_id.get(&a.array_class_obj_id()).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{:?}", a.array_class_obj_id()));
                                instances.push(format!("Object Array ID: {:?}, Class: {}", a.obj_id(), name));
                            }
                            SubRecord::PrimitiveArray(a) => {
                                instances.push(format!("Primitive Array ID: {:?}", a.obj_id()));
                            }
                            _ => {}
                        }
                        if instances.len() >= limit { break; }
                    }
                }
            }
            if instances.len() >= limit { break; }
        }
        Ok(serde_wasm_bindgen::to_value(&instances)?)
    }
}

fn val_size(tag: u8, id_size: usize) -> usize {
    match tag {
        2 => id_size, // Object
        4 => 1,       // Boolean
        5 => 2,       // Char
        6 => 4,       // Float
        7 => 8,       // Double
        8 => 1,       // Byte
        9 => 2,       // Short
        10 => 4,      // Int
        11 => 8,      // Long
        _ => 0,
    }
}
