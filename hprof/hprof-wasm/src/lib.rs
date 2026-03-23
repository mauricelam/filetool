use wasm_bindgen::prelude::*;
use jvm_hprof::{parse_hprof, RecordTag, IdSize, Id};
use jvm_hprof::heap_dump::{SubRecord};
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

    pub fn get_heap_dump_records(&self, _index: usize, _offset: usize, _limit: usize) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&Vec::<String>::new())?)
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

    pub fn get_class_reference_graph(&self) -> Result<String, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let mut utf8_map = HashMap::new();
        let mut class_id_to_name_id = HashMap::new();
        let mut obj_id_to_class_id = HashMap::new();
        let mut class_total_sizes: HashMap<Id, usize> = HashMap::new();
        let mut class_id_to_instance_size = HashMap::new();
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
                                jvm_hprof::heap_dump::SubRecord::Class(c) => { class_id_to_instance_size.insert(c.obj_id(), c.instance_size_bytes() as usize); }
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
                                *class_total_sizes.entry(scid).or_insert(0) += isize;
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

        let mut dot = String::from("digraph G {\n  rankdir=LR;\n  node [shape=box, style=filled, color=lightblue];\n");
        let max_s = *class_total_sizes.values().max().unwrap_or(&1) as f64;
        let max_r = *class_refs.values().max().unwrap_or(&1) as f64;
        for (&cid, &size) in &class_total_sizes {
            if size < (max_s * 0.05) as usize && class_total_sizes.len() > 20 { continue; }
            let name = class_id_to_name_id.get(&cid).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{:?}", cid));
            let scale = 1.0 + (size as f64 / max_s * 4.0);
            dot.push_str(&format!("  \"{:?}\" [label=\"{}\\n({} bytes)\", fontsize={}];\n", cid, name, size, 10.0 * scale));
        }
        for (&(src, tgt), &count) in &class_refs {
            if class_total_sizes.contains_key(&src) && class_total_sizes.contains_key(&tgt) {
                let pen = 1.0 + (count as f64 / max_r * 8.0);
                dot.push_str(&format!("  \"{:?}\" -> \"{:?}\" [penwidth={}, label=\"{}\"];\n", src, tgt, pen, count));
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
}

fn val_size(tag: u8, id_size: usize) -> usize {
    match tag { 2 => id_size, 4 => 1, 5 => 2, 6 => 4, 7 => 8, 8 => 1, 9 => 2, 10 => 4, 11 => 8, _ => 0 }
}
