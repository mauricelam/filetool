//! HPROF WebAssembly Backend
//!
//! This module provides high-performance parsing and analysis of JVM HPROF files
//! for the web-based viewer. It utilizes the `jvm-hprof` crate for low-level parsing
//! and exposes a set of specialized methods to the React frontend via `wasm-bindgen`.
//!
//! Key functionalities include:
//! - Efficient record indexing and searching.
//! - Extraction of instance counts and memory usage by class.
//! - Generation of class hierarchy and reference graphs in both DOT and JSON formats.
//! - Progressive loading of heap dump sub-records (instances, arrays, etc.).

use wasm_bindgen::prelude::*;
use jvm_hprof::{parse_hprof, RecordTag, IdSize, Id};
use jvm_hprof::heap_dump::{SubRecord, FieldType, FieldValue};
use serde::{Serialize, Deserialize};
use std::convert::TryInto;
use std::collections::{HashMap, HashSet, VecDeque};
use once_cell::sync::OnceCell;

mod normalize;
use normalize::normalize_hprof;

/// The main parser instance, holding the raw data and pre-computed metadata.
#[wasm_bindgen]
pub struct HprofParser {
    data: Vec<u8>,
    record_offsets: Vec<usize>,
    metadata: Vec<RecordInfo>,
    id_size: u32,
    graph: OnceCell<ObjectGraph>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct InstanceInfo {
    pub id: String,
    pub class_name: String,
    pub size: usize,
    pub fields: Vec<FieldInfo>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct FieldInfo {
    pub name: String,
    pub ftype: String,
    pub value: String,
    pub ref_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct InstanceSummary {
    pub id: String,
    pub shallow_size: usize,
}

struct ObjectGraph {
    nodes: HashMap<Id, NodeInfo>,
    roots: Vec<Id>,
    class_id_to_name: HashMap<Id, String>,
    obj_id_to_class_id: HashMap<Id, Id>,
    class_to_instances: HashMap<Id, Vec<Id>>,
    id_size: IdSize,
    idoms: HashMap<Id, Id>,
    dom_children: HashMap<Id, Vec<Id>>,
    retained_sizes: HashMap<Id, u64>,
}

#[derive(Clone)]
struct NodeInfo {
    id: Id,
    shallow_size: usize,
    references: Vec<(Option<String>, Id)>, // (field_name, target_id)
    primitives: Vec<(String, String, String)>, // (name, type, value)
    class_id: Id,
}

/// Basic header information extracted from the HPROF file.
#[derive(Serialize, Deserialize, Clone)]
pub struct HprofHeader {
    pub label: String,
    pub id_size: u32,
    pub timestamp_millis: u64,
}

/// Metadata about a single top-level HPROF record.
#[derive(Serialize, Deserialize, Clone)]
pub struct RecordInfo {
    pub index: usize,
    pub tag: String,
    pub micros_since_header_ts: u32,
}

/// Summary entry for sub-records found within a heap dump segment.
#[derive(Serialize, Deserialize)]
pub struct HeapSummaryEntry {
    pub tag: String,
    pub count: usize,
}

/// Search results containing a subset of records and the total match count.
#[derive(Serialize, Deserialize)]
pub struct SearchResult {
    pub total_count: usize,
    pub records: Vec<RecordInfo>,
}

/// Statistics for a specific Java class within the heap dump.
#[derive(Serialize, Deserialize)]
pub struct InstanceCountEntry {
    pub class_id: String,
    pub class_name: String,
    pub count: usize,
    pub total_size: usize,
}

/// Represents a node in the force-directed class hierarchy or reference graph.
#[derive(Serialize, Deserialize, Clone)]
pub struct HierarchyNode {
    /// Unique identifier for the node (usually the object ID).
    pub id: String,
    /// Human-readable name (usually the class name).
    pub name: String,
    /// Weight/size of the node, used for visual scaling (e.g., total bytes).
    pub size: u64,
    /// Total retained size (optional)
    pub retained_size: Option<u64>,
    /// Whether this node is considered a GC root.
    pub is_root: bool,
}

/// Represents a directed link between two nodes in the graph.
#[derive(Serialize, Deserialize, Clone)]
pub struct HierarchyLink {
    pub source: String,
    pub target: String,
    /// Optional weight for the link (e.g., number of references).
    pub count: Option<usize>,
    /// Total size retained by this edge (approximate)
    pub retained_size: Option<u64>,
    /// Names of fields that form this link (only for class reference graph)
    pub field_names: Option<Vec<String>>,
}

/// Container for graph data suitable for D3.js force-directed layouts.
#[derive(Serialize, Deserialize)]
pub struct HierarchyData {
    pub nodes: Vec<HierarchyNode>,
    pub links: Vec<HierarchyLink>,
}

#[derive(Serialize, Deserialize)]
pub struct SankeyData {
    pub nodes: Vec<SankeyNode>,
    pub links: Vec<SankeyLink>,
}

#[derive(Serialize, Deserialize)]
pub struct SankeyNode {
    pub name: String,
    pub id: Option<String>,
    pub retained_size: f64,
}

#[derive(Serialize, Deserialize)]
pub struct SankeyLink {
    pub source: usize,
    pub target: usize,
    pub value: f64,
    pub field_names: Option<Vec<String>>,
}

#[wasm_bindgen]
impl HprofParser {
    /// Creates a new HprofParser by indexing all records in the provided data.
    /// Handles normalization of Android-specific HPROF versions to standard format.
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<u8>) -> Self {
        std::panic::set_hook(Box::new(console_error_panic_hook::hook));

        let data = normalize_hprof(&data);
        let mut record_offsets = Vec::new();
        let mut metadata = Vec::new();
        let mut id_size = 4;

        if let Ok(hprof) = parse_hprof(&data) {
            id_size = match hprof.header().id_size() { IdSize::U32 => 4, IdSize::U64 => 8 };

            // The header consists of: label (null-terminated), ID size (4 bytes), and timestamp (8 bytes).
            let mut pos = 0;
            while pos < data.len() && data[pos] != 0 { pos += 1; }

            // pos is at the null terminator. Header ends after null + 4 + 8 = 13 bytes.
            let header_len = pos + 13;

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
        HprofParser { data, record_offsets, metadata, id_size, graph: OnceCell::new() }
    }

    fn ensure_graph(&self) -> Result<&ObjectGraph, JsValue> {
        self.graph.get_or_try_init(|| {
            let hprof = parse_hprof(&self.data).map_err(|e| format!("Error parsing hprof: {:?}", e))?;
            let mut utf8_map = HashMap::new();
            let mut class_id_to_name_id = HashMap::new();
            let mut obj_id_to_class_id = HashMap::new();
            let mut class_id_to_super_id = HashMap::new();
            let mut all_class_fields = HashMap::new();
            let mut all_static_fields = HashMap::new();
            let mut roots = Vec::new();
            let mut nodes = HashMap::new();

            let id_size = hprof.header().id_size();
            let id_bytes = match id_size { IdSize::U32 => 4, IdSize::U64 => 8 };

            // Pass 1: Collect UTF-8 and Class info
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

            let mut class_id_to_name = HashMap::new();
            for (cid, nid) in &class_id_to_name_id {
                let name = utf8_map.get(nid).cloned().unwrap_or_else(|| format!("Class@{:?}", cid));
                class_id_to_name.insert(*cid, name);
            }

            // Pass 2: Collect hierarchy and object info
            for record in hprof.records_iter() {
                let record = match record { Ok(r) => r, Err(_) => continue };
                if let Some(Ok(seg)) = record.as_heap_dump_segment() {
                    for sub in seg.sub_records() {
                        if let Ok(s) = sub {
                            match s {
                                SubRecord::Class(c) => {
                                    let cid = c.obj_id();
                                    if let Some(sid) = c.super_class_obj_id() { class_id_to_super_id.insert(cid, sid); }
                                    let mut field_descriptors = Vec::new();
                                    for ifd in c.instance_field_descriptors() {
                                        if let Ok(ifd) = ifd {
                                            let name = utf8_map.get(&ifd.name_id()).cloned().unwrap_or_else(|| format!("?{:?}", ifd.name_id()));
                                            field_descriptors.push((name, ifd.field_type()));
                                        }
                                    }
                                    all_class_fields.insert(cid, field_descriptors);

                                    let mut statics = Vec::new();
                                    for sf in c.static_fields() {
                                        if let Ok(sf) = sf {
                                            if matches!(sf.field_type(), FieldType::ObjectId) {
                                                if let FieldValue::ObjectId(val) = sf.value() {
                                                    if let Some(target_id) = val {
                                                        let name = utf8_map.get(&sf.name_id()).cloned().unwrap_or_else(|| format!("?{:?}", sf.name_id()));
                                                        statics.push((name, target_id));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    all_static_fields.insert(cid, statics);

                                    obj_id_to_class_id.insert(cid, cid); // Class is also an object
                                    nodes.insert(cid, NodeInfo { id: cid, shallow_size: 0, references: Vec::new(), primitives: Vec::new(), class_id: cid });
                                    roots.push(cid); // Classes are roots
                                }
                                SubRecord::Instance(i) => {
                                    obj_id_to_class_id.insert(i.obj_id(), i.class_obj_id());
                                }
                                jvm_hprof::heap_dump::SubRecord::ObjectArray(a) => {
                                    obj_id_to_class_id.insert(a.obj_id(), a.array_class_obj_id());
                                }
                                SubRecord::GcRootUnknown(r) => { roots.push(r.obj_id()); }
                                SubRecord::GcRootJniGlobal(r) => { roots.push(r.obj_id()); }
                                SubRecord::GcRootJavaStackFrame(r) => { roots.push(r.obj_id()); }
                                SubRecord::GcRootNativeStack(r) => { roots.push(r.obj_id()); }
                                SubRecord::GcRootSystemClass(r) => { roots.push(r.obj_id()); }
                                SubRecord::GcRootThreadBlock(r) => { roots.push(r.obj_id()); }
                                _ => {}
                            }
                        }
                    }
                }
            }

            // Pass 3: Build object graph edges
            for record in hprof.records_iter() {
                let record = match record { Ok(r) => r, Err(_) => continue };
                if let Some(Ok(seg)) = record.as_heap_dump_segment() {
                    for sub in seg.sub_records() {
                        if let Ok(s) = sub {
                            match s {
                                SubRecord::Class(c) => {
                                    let cid = c.obj_id();
                                    if let Some(statics) = all_static_fields.get(&cid) {
                                        if let Some(node) = nodes.get_mut(&cid) {
                                            for (f_name, target_id) in statics {
                                                node.references.push((Some(f_name.clone()), *target_id));
                                            }
                                        }
                                    }
                                }
                                SubRecord::Instance(i) => {
                                    let oid = i.obj_id();
                                    let cid = i.class_obj_id();
                                    let mut references = Vec::new();
                                    let mut primitives = Vec::new();
                                    let mut hierarchy = Vec::new();
                                    let mut curr = Some(cid);
                                    while let Some(c) = curr {
                                        hierarchy.push(c);
                                        curr = class_id_to_super_id.get(&c).cloned();
                                    }
                                    hierarchy.reverse();
                                    let mut data_offset = 0;
                                    let data = i.fields();
                                    let mut shallow_size = 0;
                                    for c in hierarchy {
                                        if let Some(fields) = all_class_fields.get(&c) {
                                            for (f_name, f_type) in fields {
                                                let size = field_size(*f_type, id_bytes);
                                                shallow_size += size;
                                                if matches!(f_type, FieldType::ObjectId) {
                                                    if data_offset + id_bytes <= data.len() {
                                                        let ref_id_val = match id_size {
                                                            IdSize::U32 => u32::from_be_bytes(data[data_offset..data_offset+4].try_into().unwrap()) as u64,
                                                            IdSize::U64 => u64::from_be_bytes(data[data_offset..data_offset+8].try_into().unwrap()),
                                                        };
                                                        if ref_id_val != 0 {
                                                            references.push((Some(f_name.clone()), Id::from(ref_id_val)));
                                                        } else {
                                                            primitives.push((f_name.clone(), "object".to_string(), "null".to_string()));
                                                        }
                                                    }
                                                } else {
                                                    if data_offset + size <= data.len() {
                                                        let val_str = format_primitive(&data[data_offset..data_offset+size], *f_type);
                                                        primitives.push((f_name.clone(), format!("{:?}", f_type), val_str));
                                                    }
                                                }
                                                data_offset += size;
                                            }
                                        }
                                    }
                                    nodes.insert(oid, NodeInfo { id: oid, shallow_size, references, primitives, class_id: cid });
                                }
                                SubRecord::ObjectArray(a) => {
                                    let oid = a.obj_id();
                                    let mut references = Vec::new();
                                    let count = a.elements(id_size).count();
                                    let shallow_size = count * id_bytes;
                                    for (idx, elem) in a.elements(id_size).enumerate() {
                                        if let Ok(Some(ref_id)) = elem {
                                            references.push((Some(format!("[{}]", idx)), ref_id));
                                        }
                                    }
                                    nodes.insert(oid, NodeInfo { id: oid, shallow_size, references, primitives: Vec::new(), class_id: a.array_class_obj_id() });
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }

            let mut class_to_instances: HashMap<Id, Vec<Id>> = HashMap::new();
            for (oid, info) in &nodes {
                class_to_instances.entry(info.class_id).or_default().push(*oid);
            }
            // Sort instances for consistent pagination
            for instances in class_to_instances.values_mut() {
                instances.sort_by_key(|id| format_id(*id));
            }

            // --- Dominator Tree Computation (Cooper-Harvey-Kennedy) ---
            let virtual_root = Id::from(0u64);
            let mut post_order = Vec::new();
            let mut visited = HashSet::new();
            let mut stack = Vec::new();

            for &root_id in &roots {
                if !visited.contains(&root_id) {
                    stack.push((root_id, 0));
                    while let Some((curr, ref_idx)) = stack.pop() {
                        visited.insert(curr);
                        let refs = nodes.get(&curr).map(|n| &n.references);
                        if let Some(r) = refs {
                            if ref_idx < r.len() {
                                stack.push((curr, ref_idx + 1));
                                let next_id = r[ref_idx].1;
                                if !visited.contains(&next_id) {
                                    stack.push((next_id, 0));
                                }
                            } else {
                                post_order.push(curr);
                            }
                        } else {
                            post_order.push(curr);
                        }
                    }
                }
            }
            post_order.push(virtual_root);

            let mut node_to_post_index = HashMap::new();
            for (i, &id) in post_order.iter().enumerate() {
                node_to_post_index.insert(id, i);
            }

            let mut idoms = HashMap::new();
            let _virtual_root_idx = node_to_post_index[&virtual_root];
            idoms.insert(virtual_root, virtual_root);

            // Pre-calculate predecessors for efficiency
            let mut predecessors: HashMap<Id, Vec<Id>> = HashMap::new();
            for &root_id in &roots {
                predecessors.entry(root_id).or_default().push(virtual_root);
            }
            for node in nodes.values() {
                for (_, next_id) in &node.references {
                    if node_to_post_index.contains_key(next_id) {
                        predecessors.entry(*next_id).or_default().push(node.id);
                    }
                }
            }

            let mut changed = true;
            while changed {
                changed = false;
                for &node_id in post_order.iter().rev() {
                    if node_id == virtual_root { continue; }

                    let preds = match predecessors.get(&node_id) {
                        Some(p) => p,
                        None => continue,
                    };

                    let mut new_idom = None;
                    for &p in preds {
                        if idoms.contains_key(&p) {
                            if new_idom.is_none() {
                                new_idom = Some(p);
                            } else {
                                let b1 = p;
                                let b2 = new_idom.unwrap();
                                // intersect
                                let mut finger1 = b1;
                                let mut finger2 = b2;
                                while finger1 != finger2 {
                                    while node_to_post_index[&finger1] < node_to_post_index[&finger2] {
                                        finger1 = idoms[&finger1];
                                    }
                                    while node_to_post_index[&finger2] < node_to_post_index[&finger1] {
                                        finger2 = idoms[&finger2];
                                    }
                                }
                                new_idom = Some(finger1);
                            }
                        }
                    }

                    if let Some(ni) = new_idom {
                        if idoms.get(&node_id) != Some(&ni) {
                            idoms.insert(node_id, ni);
                            changed = true;
                        }
                    }
                }
            }

            let mut dom_children: HashMap<Id, Vec<Id>> = HashMap::new();
            for (&node_id, &idom_id) in &idoms {
                if node_id != idom_id {
                    dom_children.entry(idom_id).or_default().push(node_id);
                }
            }

            let mut retained_sizes = HashMap::new();
            // Iterative retained size using post-order indices
            for &node_id in &post_order {
                let mut size = nodes.get(&node_id).map(|n| n.shallow_size as u64).unwrap_or(0);
                if let Some(children) = dom_children.get(&node_id) {
                    for &child in children {
                        size += retained_sizes.get(&child).cloned().unwrap_or(0);
                    }
                }
                retained_sizes.insert(node_id, size);
            }

            Ok(ObjectGraph { nodes, roots, class_id_to_name, obj_id_to_class_id, class_to_instances, id_size, idoms, dom_children, retained_sizes })
        }).map_err(|e: String| JsValue::from_str(&e))
    }

    /// Returns the basic header information (version, ID size, timestamp).
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

    /// Returns the total number of top-level records found in the file.
    pub fn get_total_records(&self) -> usize { self.metadata.len() }

    /// Searches for records by tag name with pagination.
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

    /// Returns a human-readable detail string for a specific record.
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

    /// Summarizes the sub-records (Class, Instance, etc.) within a HeapDump record.
    pub fn get_heap_dump_summary(&self, index: usize) -> Result<JsValue, JsValue> {
        let record_offset = *self.record_offsets.get(index).ok_or_else(|| JsValue::from_str("Record index out of bounds"))?;
        let length = u32::from_be_bytes(self.data[record_offset+5..record_offset+9].try_into().unwrap()) as usize;
        let mut record_data = Vec::with_capacity(length + 13 + 9);
        record_data.extend_from_slice(b"JAVA PROFILE 1.0.2\0");
        record_data.extend_from_slice(&self.id_size.to_be_bytes());
        record_data.extend_from_slice(&[0; 8]);
        record_data.extend_from_slice(&self.data[record_offset..record_offset+9+length]);

        let hprof = parse_hprof(&record_data).map_err(|e| JsValue::from_str(&format!("Error parsing record slice: {:?}", e)))?;
        let record = hprof.records_iter().next().ok_or("No record in slice")?
            .map_err(|e| JsValue::from_str(&format!("Error getting record from slice: {:?}", e)))?;
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

    /// Returns a paginated list of human-readable strings for sub-records in a HeapDump.
    pub fn get_heap_dump_records(&self, index: usize, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
        let record_offset = *self.record_offsets.get(index).ok_or_else(|| JsValue::from_str("Record index out of bounds"))?;
        let length = u32::from_be_bytes(self.data[record_offset+5..record_offset+9].try_into().unwrap()) as usize;
        let mut record_data = Vec::with_capacity(length + 13 + 9);
        record_data.extend_from_slice(b"JAVA PROFILE 1.0.2\0");
        record_data.extend_from_slice(&self.id_size.to_be_bytes());
        record_data.extend_from_slice(&[0; 8]);
        record_data.extend_from_slice(&self.data[record_offset..record_offset+9+length]);

        let hprof = parse_hprof(&record_data).map_err(|e| JsValue::from_str(&format!("Error parsing record slice: {:?}", e)))?;
        let record = hprof.records_iter().next().ok_or("No record in slice")?
            .map_err(|e| JsValue::from_str(&format!("Error getting record from slice: {:?}", e)))?;
        let id_size = hprof.header().id_size();
        let tag = record.tag();
        if tag == RecordTag::HeapDump || tag == RecordTag::HeapDumpSegment {
            let segment = record.as_heap_dump_segment().ok_or("Expected heap dump segment")?
                .map_err(|e| JsValue::from_str(&format!("Error parsing segment: {:?}", e)))?;
            let mut results = Vec::new();
            for sub in segment.sub_records().skip(offset).take(limit) {
                if let Ok(s) = sub {
                    let desc = match s {
                        SubRecord::Class(c) => format!("Class ID: {}, Super: {}, Instance Size: {}", format_id(c.obj_id()), c.super_class_obj_id().map(format_id).unwrap_or_else(|| "null".to_string()), c.instance_size_bytes()),
                        SubRecord::Instance(i) => format!("Instance ID: {}, Class ID: {}", format_id(i.obj_id()), format_id(i.class_obj_id())),
                        SubRecord::ObjectArray(a) => format!("Object Array ID: {}, Class ID: {}, Length: {}", format_id(a.obj_id()), format_id(a.array_class_obj_id()), a.elements(id_size).count()),
                        SubRecord::PrimitiveArray(a) => format!("Primitive Array ID: {}", format_id(a.obj_id())),
                        SubRecord::GcRootUnknown(r) => format!("Root Unknown: {}", format_id(r.obj_id())),
                        SubRecord::GcRootThreadObj(r) => format!("Root Thread Object: Thread Serial: {}, Stack Depth: {}", r.thread_serial(), r.stack_trace_serial()),
                        _ => format!("{:?}", s),
                    };
                    results.push(desc);
                }
            }
            Ok(serde_wasm_bindgen::to_value(&results)?)
        } else { Err(JsValue::from_str("Record is not a heap dump")) }
    }

    /// Aggregates instance counts and total memory usage for all loaded classes.
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
            let name = class_id_to_name_id.get(&cid).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{}", format_id(cid)));
            let mut size = total_sizes.get(&cid).cloned().unwrap_or(0);
            if let Some(&isize) = class_id_to_instance_size.get(&cid) { size += count * isize; }
            result.push(InstanceCountEntry { class_id: format_id(cid), class_name: name, count, total_size: size });
        }
        result.sort_by(|a, b| b.total_size.cmp(&a.total_size));
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    pub fn get_class_instances(&self, class_id_str: String, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
        let graph = self.ensure_graph()?;
        let class_id = parse_id(&class_id_str, graph.id_size)?;

        let instances = graph.class_to_instances.get(&class_id);
        if let Some(list) = instances {
            let start = offset.min(list.len());
            let end = (offset + limit).min(list.len());
            let result: Vec<InstanceSummary> = list[start..end].iter().map(|&oid| {
                let shallow_size = graph.nodes.get(&oid).map(|n| n.shallow_size).unwrap_or(0);
                InstanceSummary { id: format_id(oid), shallow_size }
            }).collect();
            Ok(serde_wasm_bindgen::to_value(&result)?)
        } else {
            Ok(serde_wasm_bindgen::to_value(&Vec::<InstanceSummary>::new())?)
        }
    }

    pub fn get_instance_info(&self, obj_id_str: String) -> Result<JsValue, JsValue> {
        let graph = self.ensure_graph()?;
        let obj_id = parse_id(&obj_id_str, graph.id_size)?;
        let node = graph.nodes.get(&obj_id).ok_or_else(|| format!("Object not found: {}", obj_id_str))?;
        let class_name = graph.class_id_to_name.get(&node.class_id).cloned().unwrap_or_else(|| "Unknown".to_string());

        let mut fields = Vec::new();
        for (f_name, target_id) in &node.references {
            fields.push(FieldInfo {
                name: f_name.clone().unwrap_or_else(|| "unknown".to_string()),
                ftype: "object".to_string(),
                value: format_id(*target_id),
                ref_id: Some(format_id(*target_id)),
            });
        }
        for (f_name, f_type, f_val) in &node.primitives {
            fields.push(FieldInfo {
                name: f_name.clone(),
                ftype: f_type.clone(),
                value: f_val.clone(),
                ref_id: None,
            });
        }

        Ok(serde_wasm_bindgen::to_value(&InstanceInfo {
            id: obj_id_str,
            class_name,
            size: node.shallow_size,
            fields,
        })?)
    }

    pub fn get_shortest_path_to_gc_root(&self, obj_id_str: String) -> Result<JsValue, JsValue> {
        let graph = self.ensure_graph()?;
        let target_id = parse_id(&obj_id_str, graph.id_size)?;

        let mut parent_map: HashMap<Id, (Id, Option<String>)> = HashMap::new();
        let mut queue = VecDeque::new();
        let mut visited = HashSet::new();

        for &root_id in &graph.roots {
            if root_id == target_id {
                let root_cname = graph.obj_id_to_class_id.get(&root_id).and_then(|cid| graph.class_id_to_name.get(cid)).cloned().unwrap_or_else(|| "Unknown".to_string());
                return Ok(serde_wasm_bindgen::to_value(&vec![vec![format!("Root: {} ({})", root_cname, format_id(root_id))]])?);
            }
            queue.push_back(root_id);
            visited.insert(root_id);
        }

        while let Some(curr_id) = queue.pop_front() {
            if let Some(node) = graph.nodes.get(&curr_id) {
                for (f_name, next_id) in &node.references {
                    if !visited.contains(next_id) {
                        visited.insert(*next_id);
                        parent_map.insert(*next_id, (curr_id, f_name.clone()));
                        queue.push_back(*next_id);
                        if *next_id == target_id {
                            // Path found
                            let mut path = Vec::new();
                            let mut p = target_id;
                            while let Some(&(parent, ref name)) = parent_map.get(&p) {
                                let cname = graph.obj_id_to_class_id.get(&p).and_then(|cid| graph.class_id_to_name.get(cid)).cloned().unwrap_or_else(|| "Unknown".to_string());
                                path.push(format!("{} ({}) via {:?}", cname, format_id(p), name));
                                p = parent;
                            }
                            let root_cname = graph.obj_id_to_class_id.get(&p).and_then(|cid| graph.class_id_to_name.get(cid)).cloned().unwrap_or_else(|| "Unknown".to_string());
                            path.push(format!("Root: {}", root_cname));
                            path.reverse();
                            return Ok(serde_wasm_bindgen::to_value(&vec![path])?);
                        }
                    }
                }
            }
        }

        Ok(JsValue::NULL)
    }

    pub fn get_all_paths_to_gc_root(&self, obj_id_str: String, limit: usize) -> Result<JsValue, JsValue> {
        let graph = self.ensure_graph()?;
        let target_id = parse_id(&obj_id_str, graph.id_size)?;

        // Reverse search from target to roots
        // First find distances using BFS to guide DFS
        let mut dists: HashMap<Id, usize> = HashMap::new();
        let mut queue = VecDeque::new();
        for &root_id in &graph.roots {
            dists.insert(root_id, 0);
            queue.push_back(root_id);
        }

        while let Some(curr) = queue.pop_front() {
            let d = dists[&curr];
            if curr == target_id { break; }
            if let Some(node) = graph.nodes.get(&curr) {
                for (_, next_id) in &node.references {
                    if !dists.contains_key(next_id) {
                        dists.insert(*next_id, d + 1);
                        queue.push_back(*next_id);
                    }
                }
            }
        }

        if !dists.contains_key(&target_id) {
            return Ok(JsValue::NULL);
        }

        // Now find multiple paths using DFS guided by distances (only moving forward)
        let mut paths = Vec::new();
        let mut current_path = Vec::new();
        let mut visited_in_dfs = HashSet::new();

        fn find_paths(
            curr: Id,
            target: Id,
            graph: &ObjectGraph,
            dists: &HashMap<Id, usize>,
            current_path: &mut Vec<(Id, Option<String>)>,
            paths: &mut Vec<Vec<String>>,
            visited: &mut HashSet<Id>,
            limit: usize
        ) {
            if paths.len() >= limit { return; }
            if curr == target {
                // Construct path strings
                let mut path_strings = Vec::new();
                let root_id = current_path[0].0;
                let root_cname = graph.obj_id_to_class_id.get(&root_id).and_then(|cid| graph.class_id_to_name.get(cid)).cloned().unwrap_or_else(|| "Unknown".to_string());
                path_strings.push(format!("Root: {} ({})", root_cname, format_id(root_id)));

                for i in 1..current_path.len() {
                    let (oid, ref name) = current_path[i];
                    let cname = graph.obj_id_to_class_id.get(&oid).and_then(|cid| graph.class_id_to_name.get(cid)).cloned().unwrap_or_else(|| "Unknown".to_string());
                    path_strings.push(format!("{} ({}) via {:?}", cname, format_id(oid), name));
                }

                // Add target itself
                let target_cname = graph.obj_id_to_class_id.get(&target).and_then(|cid| graph.class_id_to_name.get(cid)).cloned().unwrap_or_else(|| "Unknown".to_string());
                path_strings.push(format!("{} (Target)", target_cname));

                paths.push(path_strings);
                return;
            }

            if let Some(node) = graph.nodes.get(&curr) {
                let curr_dist = dists[&curr];
                for (f_name, next_id) in &node.references {
                    if let Some(&next_dist) = dists.get(next_id) {
                        if next_dist > curr_dist && !visited.contains(next_id) {
                            visited.insert(*next_id);
                            current_path.push((*next_id, f_name.clone()));
                            find_paths(*next_id, target, graph, dists, current_path, paths, visited, limit);
                            current_path.pop();
                            visited.remove(next_id);
                            if paths.len() >= limit { return; }
                        }
                    }
                }
            }
        }

        for &root_id in &graph.roots {
             current_path.push((root_id, None));
             visited_in_dfs.insert(root_id);
             find_paths(root_id, target_id, graph, &dists, &mut current_path, &mut paths, &mut visited_in_dfs, limit);
             visited_in_dfs.remove(&root_id);
             current_path.pop();
             if paths.len() >= limit { break; }
        }

        Ok(serde_wasm_bindgen::to_value(&paths)?)
    }

    pub fn calculate_retained_size(&self, obj_id_str: String) -> Result<u64, JsValue> {
        let graph = self.ensure_graph()?;
        let target_id = parse_id(&obj_id_str, graph.id_size)?;
        Ok(graph.retained_sizes.get(&target_id).cloned().unwrap_or(0))
    }

    pub fn get_sankey_data(&self, root_id_str: Option<String>) -> Result<JsValue, JsValue> {
        let graph = self.ensure_graph()?;
        let virtual_root = Id::from(0u64);
        let start_node = if let Some(r_id_str) = root_id_str {
            parse_id(&r_id_str, graph.id_size)?
        } else {
            virtual_root
        };

        let mut sankey_nodes = Vec::new();
        let mut sankey_links = Vec::new();
        // Use a pair (object_id, type) where type is 0: normal, 1: self, 2: others
        let mut node_to_idx: HashMap<(Id, u8), usize> = HashMap::new();

        let mut current_level = vec![start_node];

        let start_name = if start_node == virtual_root {
            "Root GC".to_string()
        } else {
            let class_id = graph.obj_id_to_class_id.get(&start_node).cloned().unwrap_or(start_node);
            graph.class_id_to_name.get(&class_id).cloned().unwrap_or_else(|| format_id(start_node))
        };

        let start_idx = sankey_nodes.len();
        node_to_idx.insert((start_node, 0), start_idx);
        sankey_nodes.push(SankeyNode {
            name: start_name,
            id: Some(format_id(start_node)),
            retained_size: graph.retained_sizes.get(&start_node).cloned().unwrap_or(0) as f64,
        });

        let max_depth = 5;
        let mut visited_ids = HashSet::new();
        visited_ids.insert(start_node);

        for _ in 0..max_depth {
            let mut next_level = Vec::new();
            for &parent_id in &current_level {
                let parent_idx = node_to_idx[&(parent_id, 0)];

                // Add <self> link
                let shallow_size = graph.nodes.get(&parent_id).map(|n| n.shallow_size as f64).unwrap_or(0.0);
                if shallow_size > 0.0 {
                    let self_idx = sankey_nodes.len();
                    sankey_nodes.push(SankeyNode {
                        name: "<self>".to_string(),
                        id: None,
                        retained_size: shallow_size,
                    });
                    sankey_links.push(SankeyLink {
                        source: parent_idx,
                        target: self_idx,
                        value: shallow_size,
                        field_names: None,
                    });
                }

                if let Some(children) = graph.dom_children.get(&parent_id) {
                    let mut sorted_children = children.clone();
                    sorted_children.sort_by(|a, b| {
                        let sa = graph.retained_sizes.get(a).cloned().unwrap_or(0);
                        let sb = graph.retained_sizes.get(b).cloned().unwrap_or(0);
                        sb.cmp(&sa)
                    });

                    let limit = 8;
                    let mut others_size = 0.0;

                    for (i, &child_id) in sorted_children.iter().enumerate() {
                        let child_retained = graph.retained_sizes.get(&child_id).cloned().unwrap_or(0) as f64;
                        if i >= limit {
                            others_size += child_retained;
                            continue;
                        }

                        if visited_ids.contains(&child_id) { continue; }
                        visited_ids.insert(child_id);

                        let child_idx = sankey_nodes.len();
                        let class_id = graph.obj_id_to_class_id.get(&child_id).cloned().unwrap_or(child_id);
                        let child_name = graph.class_id_to_name.get(&class_id).cloned().unwrap_or_else(|| format_id(child_id));

                        sankey_nodes.push(SankeyNode {
                            name: child_name,
                            id: Some(format_id(child_id)),
                            retained_size: child_retained,
                        });
                        node_to_idx.insert((child_id, 0), child_idx);
                        next_level.push(child_id);

                        let mut field_names = Vec::new();
                        if let Some(parent_node) = graph.nodes.get(&parent_id) {
                            for (f_name, target_id) in &parent_node.references {
                                if *target_id == child_id {
                                    if let Some(name) = f_name {
                                        field_names.push(name.clone());
                                    }
                                }
                            }
                        }

                        sankey_links.push(SankeyLink {
                            source: parent_idx,
                            target: child_idx,
                            value: if child_retained > 0.0 { child_retained } else { 1.0 },
                            field_names: if field_names.is_empty() { None } else { Some(field_names) },
                        });
                    }

                    if others_size > 0.0 {
                        let others_idx = sankey_nodes.len();
                        sankey_nodes.push(SankeyNode {
                            name: "Others".to_string(),
                            id: None,
                            retained_size: others_size,
                        });
                        sankey_links.push(SankeyLink {
                            source: parent_idx,
                            target: others_idx,
                            value: others_size,
                            field_names: None,
                        });
                    }
                }
            }
            if next_level.is_empty() { break; }
            current_level = next_level;
        }

        Ok(serde_wasm_bindgen::to_value(&SankeyData { nodes: sankey_nodes, links: sankey_links })?)
    }

    /// Computes the number of references between all classes to provide weight metadata for edge filtering.
    pub fn get_reference_weights(&self) -> Result<JsValue, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let mut obj_id_to_class_id = HashMap::new();
        let mut class_id_to_super_id = HashMap::new();
        let mut all_class_fields = HashMap::new();
        let id_size = hprof.header().id_size();
        let id_bytes = match id_size { IdSize::U32 => 4, IdSize::U64 => 8 };

        for record in hprof.records_iter() {
            let record = match record { Ok(r) => r, Err(_) => continue };
            if let Some(Ok(seg)) = record.as_heap_dump_segment() {
                for sub in seg.sub_records() {
                    if let Ok(s) = sub {
                        match s {
                            jvm_hprof::heap_dump::SubRecord::Class(c) => {
                                let cid = c.obj_id();
                                if let Some(sid) = c.super_class_obj_id() { class_id_to_super_id.insert(cid, sid); }
                                let mut field_types = Vec::new();
                                for ifd in c.instance_field_descriptors() {
                                    if let Ok(ifd) = ifd { field_types.push(ifd.field_type()); }
                                }
                                all_class_fields.insert(cid, field_types);
                            }
                            jvm_hprof::heap_dump::SubRecord::Instance(i) => { obj_id_to_class_id.insert(i.obj_id(), i.class_obj_id()); }
                            jvm_hprof::heap_dump::SubRecord::ObjectArray(a) => { obj_id_to_class_id.insert(a.obj_id(), a.array_class_obj_id()); }
                            _ => {}
                        }
                    }
                }
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
                                let mut hierarchy = Vec::new();
                                let mut curr = Some(scid);
                                while let Some(cid) = curr {
                                    hierarchy.push(cid);
                                    curr = class_id_to_super_id.get(&cid).cloned();
                                }
                                hierarchy.reverse();
                                let mut data_offset = 0;
                                let data = i.fields();
                                for cid in hierarchy {
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
                                            data_offset += field_size(ftype, id_bytes);
                                        }
                                    }
                                }
                            }
                            jvm_hprof::heap_dump::SubRecord::ObjectArray(a) => {
                                let scid = a.array_class_obj_id();
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

        let weights: Vec<usize> = class_refs.values().cloned().collect();
        Ok(serde_wasm_bindgen::to_value(&weights)?)
    }

    /// Generates a Graphviz DOT representation of the class reference graph.
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
                                let mut hierarchy = Vec::new();
                                let mut curr = Some(scid);
                                while let Some(cid) = curr {
                                    hierarchy.push(cid);
                                    curr = class_id_to_super_id.get(&cid).cloned();
                                }
                                hierarchy.reverse();
                                let mut data_offset = 0;
                                let data = i.fields();
                                for cid in hierarchy {
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
                                            data_offset += field_size(ftype, id_bytes);
                                        }
                                    }
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

    /// Returns JSON data for the class hierarchy diagram.
    /// Filters out `java.lang.Object` (and its link-equivalents) to reduce visual clutter.
    pub fn get_class_hierarchy_json(&self) -> Result<JsValue, JsValue> {
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

        let mut nodes = HashMap::new();
        let mut links = Vec::new();

        for (cid, sid) in class_id_to_super_id {
            let cid_str = format!("{:?}", cid);
            let sid_str = format!("{:?}", sid);

            let cname = class_id_to_name_id.get(&cid).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{}", cid_str));
            let sname = class_id_to_name_id.get(&sid).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{}", sid_str));

            if cname == "java.lang.Object" || cname == "java/lang/Object" {
                continue;
            }

            nodes.entry(cid_str.clone()).or_insert(HierarchyNode { id: cid_str.clone(), name: cname, size: 0, retained_size: None, is_root: false });

            if sname != "java.lang.Object" && sname != "java/lang/Object" {
                nodes.entry(sid_str.clone()).or_insert(HierarchyNode { id: sid_str.clone(), name: sname, size: 0, retained_size: None, is_root: false });
                links.push(HierarchyLink { source: cid_str, target: sid_str, count: None, retained_size: None, field_names: None });
            }
        }

        let data = HierarchyData {
            nodes: nodes.into_values().collect(),
            links,
        };

        Ok(serde_wasm_bindgen::to_value(&data)?)
    }

    /// Returns JSON data for the class reference graph, including weighted links and node sizes.
    pub fn get_class_reference_graph_json(&self, min_edge_count: usize) -> Result<JsValue, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let mut utf8_map = HashMap::new();
        let mut class_id_to_name_id = HashMap::new();
        let mut obj_id_to_class_id = HashMap::new();
        let mut class_total_sizes: HashMap<Id, usize> = HashMap::new();

        let mut class_id_to_super_id = HashMap::new();
        let mut class_id_to_instance_size = HashMap::new();
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

                                    let mut field_descriptors = Vec::new();
                                    for ifd in c.instance_field_descriptors() {
                                        if let Ok(ifd) = ifd {
                                            let name = utf8_map.get(&ifd.name_id()).cloned().unwrap_or_else(|| format!("?{:?}", ifd.name_id()));
                                            field_descriptors.push((name, ifd.field_type()));
                                        }
                                    }
                                    all_class_fields.insert(cid, field_descriptors);
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

        let mut class_refs: HashMap<(Id, Id), (usize, HashSet<String>)> = HashMap::new();
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
                                let mut hierarchy = Vec::new();
                                let mut curr = Some(scid);
                                while let Some(cid) = curr {
                                    hierarchy.push(cid);
                                    curr = class_id_to_super_id.get(&cid).cloned();
                                }
                                hierarchy.reverse();
                                let mut data_offset = 0;
                                let data = i.fields();
                                for cid in hierarchy {
                                    if let Some(fields) = all_class_fields.get(&cid) {
                                        for (f_name, f_type) in fields {
                                            if matches!(f_type, FieldType::ObjectId) {
                                                if data_offset + id_bytes <= data.len() {
                                                    let ref_id_val = match id_size {
                                                        IdSize::U32 => u32::from_be_bytes(data[data_offset..data_offset+4].try_into().unwrap()) as u64,
                                                        IdSize::U64 => u64::from_be_bytes(data[data_offset..data_offset+8].try_into().unwrap()),
                                                    };
                                                    if ref_id_val != 0 {
                                                        let ref_id = Id::from(ref_id_val);
                                                        if let Some(&tcid) = obj_id_to_class_id.get(&ref_id) {
                                                            let entry = class_refs.entry((scid, tcid)).or_insert((0, HashSet::new()));
                                                            entry.0 += 1;
                                                            entry.1.insert(f_name.clone());
                                                        }
                                                    }
                                                }
                                            }
                                            data_offset += field_size(*f_type, id_bytes);
                                        }
                                    }
                                }
                            }
                            jvm_hprof::heap_dump::SubRecord::ObjectArray(a) => {
                                let scid = a.array_class_obj_id();
                                let size = a.elements(id_size).count() * id_bytes;
                                *class_total_sizes.entry(scid).or_insert(0) += size;
                                for elem in a.elements(id_size) {
                                    if let Ok(Some(tid)) = elem {
                                        if let Some(&tcid) = obj_id_to_class_id.get(&tid) {
                                            let entry = class_refs.entry((scid, tcid)).or_insert((0, HashSet::new()));
                                            entry.0 += 1;
                                            entry.1.insert("[]".to_string());
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

        let mut nodes = HashMap::new();
        let mut links = Vec::new();
        let max_s = *class_total_sizes.values().max().unwrap_or(&1) as f64;

        let root_classes: HashSet<Id> = self.graph.get().map(|g| {
            g.roots.iter().filter_map(|rid| g.obj_id_to_class_id.get(rid)).cloned().collect()
        }).unwrap_or_default();

        for (&cid, &size) in &class_total_sizes {
            let name = class_id_to_name_id.get(&cid).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{}", format_id(cid)));
            if size < (max_s * 0.05) as usize && class_total_sizes.len() > 20 && name != "java.lang.Object" { continue; }

            let cid_str = format_id(cid);
            let retained_size = self.calculate_class_retained_size(cid).ok();
            nodes.insert(cid_str.clone(), HierarchyNode { id: cid_str, name, size: size as u64, retained_size, is_root: root_classes.contains(&cid) });
        }

        for (&(src, tgt), (count, fields)) in &class_refs {
            if *count < min_edge_count { continue; }
            let src_str = format_id(src);
            let tgt_str = format_id(tgt);
            if nodes.contains_key(&src_str) && nodes.contains_key(&tgt_str) {
                links.push(HierarchyLink {
                    source: src_str,
                    target: tgt_str,
                    count: Some(*count),
                    retained_size: None, // Edge-level retained size is expensive, skip for now
                    field_names: Some(fields.iter().cloned().collect()),
                });
            }
        }

        let data = HierarchyData {
            nodes: nodes.into_values().collect(),
            links,
        };

        Ok(serde_wasm_bindgen::to_value(&data)?)
    }

    /// Generates a Graphviz DOT representation of the class hierarchy.
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

    /// Extracts a limited number of instances and arrays from the heap dump as strings.
    pub fn get_all_instances(&self, limit: usize) -> Result<JsValue, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let mut utf8_map = HashMap::new();
        let mut class_id_to_name_id = HashMap::new();
        let mut heap_dump_indices = Vec::new();

        // Pass 1: Collect UTF-8 strings and class mappings
        for (idx, record) in hprof.records_iter().enumerate() {
            let record = match record { Ok(r) => r, Err(_) => continue };
            match record.tag() {
                RecordTag::Utf8 => if let Some(Ok(u)) = record.as_utf_8() {
                    if let Ok(s) = u.text_as_str() { utf8_map.insert(u.name_id(), s.to_string()); }
                },
                RecordTag::LoadClass => if let Some(Ok(l)) = record.as_load_class() {
                    class_id_to_name_id.insert(l.class_obj_id(), l.class_name_id());
                },
                RecordTag::HeapDump | RecordTag::HeapDumpSegment => {
                    heap_dump_indices.push(idx);
                }
                _ => {}
            }
        }

        let mut instances = Vec::new();
        for &idx in &heap_dump_indices {
            let record_offset = self.record_offsets[idx];
            let length = u32::from_be_bytes(self.data[record_offset+5..record_offset+9].try_into().unwrap()) as usize;
            let mut record_data = Vec::with_capacity(length + 13 + 9);
            record_data.extend_from_slice(b"JAVA PROFILE 1.0.2\0");
            record_data.extend_from_slice(&self.id_size.to_be_bytes());
            record_data.extend_from_slice(&[0; 8]);
            record_data.extend_from_slice(&self.data[record_offset..record_offset+9+length]);

            let sub_hprof = parse_hprof(&record_data).map_err(|e| JsValue::from_str(&format!("Error parsing record slice: {:?}", e)))?;
            let record = sub_hprof.records_iter().next().ok_or("No record in slice")?
                .map_err(|e| JsValue::from_str(&format!("Error getting record from slice: {:?}", e)))?;

            if let Some(Ok(seg)) = record.as_heap_dump_segment() {
                for sub in seg.sub_records() {
                    if let Ok(sub) = sub {
                        match sub {
                            SubRecord::Instance(i) => {
                                let name = class_id_to_name_id.get(&i.class_obj_id()).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{}", format_id(i.class_obj_id())));
                                instances.push(format!("ID: {}, Class: {}", format_id(i.obj_id()), name));
                            }
                            SubRecord::ObjectArray(a) => {
                                let name = class_id_to_name_id.get(&a.array_class_obj_id()).and_then(|nid| utf8_map.get(nid)).cloned().unwrap_or_else(|| format!("Class@{}", format_id(a.array_class_obj_id())));
                                instances.push(format!("Object Array ID: {}, Class: {}", format_id(a.obj_id()), name));
                            }
                            SubRecord::PrimitiveArray(a) => {
                                instances.push(format!("Primitive Array ID: {}", format_id(a.obj_id())));
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

/// Utility function to calculate the byte size of a primitive field or an object reference.
fn field_size(ftype: FieldType, id_size: usize) -> usize {
    match ftype {
        FieldType::ObjectId => id_size,
        FieldType::Boolean => 1,
        FieldType::Char => 2,
        FieldType::Float => 4,
        FieldType::Double => 8,
        FieldType::Byte => 1,
        FieldType::Short => 2,
        FieldType::Int => 4,
        FieldType::Long => 8,
    }
}

fn format_primitive(data: &[u8], ftype: FieldType) -> String {
    match ftype {
        FieldType::Boolean => format!("{}", data[0] != 0),
        FieldType::Char => format!("{}", u16::from_be_bytes(data.try_into().unwrap_or([0;2])) as u8 as char), // simplified char
        FieldType::Float => format!("{}", f32::from_be_bytes(data.try_into().unwrap_or([0;4]))),
        FieldType::Double => format!("{}", f64::from_be_bytes(data.try_into().unwrap_or([0;8]))),
        FieldType::Byte => format!("{}", data[0]),
        FieldType::Short => format!("{}", i16::from_be_bytes(data.try_into().unwrap_or([0;2]))),
        FieldType::Int => format!("{}", i32::from_be_bytes(data.try_into().unwrap_or([0;4]))),
        FieldType::Long => format!("{}", i64::from_be_bytes(data.try_into().unwrap_or([0;8]))),
        FieldType::ObjectId => "ref".to_string(),
    }
}

fn format_id(id: Id) -> String {
    // Robust extraction from Debug string to get the raw numeric value, then format as hex.
    let s = format!("{:?}", id);
    let val_str = if s.starts_with("Id(") && s.ends_with(")") {
        &s[3..s.len()-1]
    } else if s.starts_with("Id { id: ") && s.ends_with(" }") {
        &s[9..s.len()-2]
    } else {
        &s
    };
    if let Ok(val) = val_str.parse::<u64>() {
        format!("0x{:x}", val)
    } else {
        s
    }
}

fn parse_id(s: &str, _id_size: IdSize) -> Result<Id, JsValue> {
    if s.starts_with("0x") {
        let val = u64::from_str_radix(&s[2..], 16).map_err(|_| "Failed to parse hex Id")?;
        return Ok(Id::from(val));
    }
    // Handle both Id(123) and Id { id: 123 } and raw decimal
    let val_str = if s.starts_with("Id(") && s.ends_with(")") {
        &s[3..s.len()-1]
    } else if s.starts_with("Id { id: ") && s.ends_with(" }") {
        &s[9..s.len()-2]
    } else {
        s
    };
    let val: u64 = val_str.parse().map_err(|_| format!("Failed to parse Id value: {}", s))?;
    Ok(Id::from(val))
}

impl HprofParser {
    fn calculate_class_retained_size(&self, class_id: Id) -> Result<u64, JsValue> {
        let graph = self.ensure_graph()?;
        let mut total_retained = 0u64;
        let mut class_instances = HashSet::new();
        for node in graph.nodes.values() {
            if node.class_id == class_id {
                class_instances.insert(node.id);
            }
        }

        for &oid in &class_instances {
            // Only add the retained size if no ancestor in the dominator tree is also an instance of this class
            let mut is_dominated_by_same_class = false;
            let mut curr = oid;
            while let Some(&parent) = graph.idoms.get(&curr) {
                if parent == curr || parent == Id::from(0u64) { break; }
                if class_instances.contains(&parent) {
                    is_dominated_by_same_class = true;
                    break;
                }
                curr = parent;
            }
            if !is_dominated_by_same_class {
                total_retained += graph.retained_sizes.get(&oid).cloned().unwrap_or(0);
            }
        }
        Ok(total_retained)
    }
}
