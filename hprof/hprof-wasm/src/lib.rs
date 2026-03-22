use wasm_bindgen::prelude::*;
use jvm_hprof::{parse_hprof, RecordTag, IdSize};
use serde::{Serialize, Deserialize};
use std::convert::TryInto;

#[wasm_bindgen]
pub struct HprofParser {
    data: Vec<u8>,
    header_len: usize,
    record_offsets: Vec<usize>,
    metadata: Vec<RecordInfo>,
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

#[wasm_bindgen]
impl HprofParser {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<u8>) -> Self {
        std::panic::set_hook(Box::new(console_error_panic_hook::hook));

        let mut header_len = 0;
        let mut record_offsets = Vec::new();
        let mut metadata = Vec::new();

        if let Ok(hprof) = parse_hprof(&data) {
            let mut pos = 0;
            while pos < data.len() && data[pos] != 0 {
                pos += 1;
            }
            pos += 1; // null byte
            pos += 4; // id_size
            pos += 8; // timestamp
            header_len = pos;

            let mut curr = header_len;
            let mut index = 0;
            // Iterate manually to be safer with large/corrupt files
            while curr + 9 <= data.len() {
                record_offsets.push(curr);

                let tag_byte = data[curr];
                let tag_name = match tag_byte {
                    0x01 => "Utf8",
                    0x02 => "LoadClass",
                    0x03 => "UnloadClass",
                    0x04 => "StackFrame",
                    0x05 => "StackTrace",
                    0x06 => "AllocSites",
                    0x07 => "HeapSummary",
                    0x0A => "StartThread",
                    0x0B => "EndThread",
                    0x0C => "HeapDump",
                    0x1C => "HeapDumpSegment",
                    0x2C => "HeapDumpEnd",
                    0x0D => "CpuSamples",
                    0x0E => "ControlSettings",
                    _ => "Unknown",
                };

                let micros = u32::from_be_bytes(data[curr+1..curr+5].try_into().unwrap_or([0; 4]));
                let length = u32::from_be_bytes(data[curr+5..curr+9].try_into().unwrap_or([0; 4])) as usize;

                metadata.push(RecordInfo {
                    index,
                    tag: tag_name.to_string(),
                    micros_since_header_ts: micros,
                });

                curr += 9 + length;
                index += 1;
            }
            drop(hprof);
        }

        HprofParser { data, header_len, record_offsets, metadata }
    }

    pub fn get_header(&self) -> Result<JsValue, JsValue> {
        let hprof = parse_hprof(&self.data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let header = hprof.header();
        let info = HprofHeader {
            label: header.label().unwrap_or("<Invalid UTF-8>").to_string(),
            id_size: match header.id_size() {
                IdSize::U32 => 4,
                IdSize::U64 => 8,
            },
            timestamp_millis: header.timestamp_millis(),
        };
        Ok(serde_wasm_bindgen::to_value(&info)?)
    }

    pub fn get_total_records(&self) -> usize {
        self.metadata.len()
    }

    pub fn search_records(&self, query: String, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
        let query_lower = query.to_lowercase();
        let filtered: Vec<_> = self.metadata.iter()
            .filter(|r| query_lower.is_empty() || r.tag.to_lowercase().contains(&query_lower))
            .collect();

        let total_count = filtered.len();
        let start = offset.min(total_count);
        let end = (offset + limit).min(total_count);

        let records: Vec<RecordInfo> = filtered[start..end].iter().map(|&&ref r| r.clone()).collect();

        let result = SearchResult {
            total_count,
            records,
        };
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    pub fn get_record_detail(&self, index: usize) -> Result<JsValue, JsValue> {
        let offset = *self.record_offsets.get(index).ok_or_else(|| JsValue::from_str("Record index out of bounds"))?;
        if offset + 9 > self.data.len() {
            return Err(JsValue::from_str("Record header truncated"));
        }
        let length = u32::from_be_bytes(self.data[offset + 5..offset + 9].try_into().map_err(|_| "Invalid offset data")?) as usize;

        if offset + 9 + length > self.data.len() {
            return Err(JsValue::from_str("Record data truncated"));
        }

        let mut mini_data = Vec::with_capacity(self.header_len + 9 + length);
        mini_data.extend_from_slice(&self.data[..self.header_len]);
        mini_data.extend_from_slice(&self.data[offset..offset + 9 + length]);

        let hprof = parse_hprof(&mini_data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let record = hprof.records_iter().next()
            .ok_or_else(|| JsValue::from_str("Failed to parse record"))?
            .map_err(|e| JsValue::from_str(&format!("Error parsing record: {:?}", e)))?;

        let detail = match record.tag() {
            RecordTag::Utf8 => {
                let utf8 = record.as_utf_8().unwrap().map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
                format!("Utf8: {}", utf8.text_as_str().unwrap_or("<Invalid UTF-8>"))
            }
            RecordTag::LoadClass => {
                let load_class = record.as_load_class().unwrap().map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
                format!("LoadClass: class_serial={}, class_obj_id={:?}, stack_trace_serial={}, class_name_id={:?}",
                    load_class.class_serial(), load_class.class_obj_id(), load_class.stack_trace_serial(), load_class.class_name_id())
            }
            RecordTag::StackFrame => {
                let stack_frame = record.as_stack_frame().unwrap().map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
                format!("StackFrame: id={:?}, method_name_id={:?}, method_signature_id={:?}, source_file_name_id={:?}, class_serial={}, line_num={:?}",
                    stack_frame.id(), stack_frame.method_name_id(), stack_frame.method_signature_id(), stack_frame.source_file_name_id(), stack_frame.class_serial(), stack_frame.line_num())
            }
            RecordTag::StackTrace => {
                let stack_trace = record.as_stack_trace().unwrap().map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
                let frame_ids: Vec<_> = stack_trace.frame_ids().collect();
                format!("StackTrace: serial={}, thread_serial={}, frame_ids={:?}",
                    stack_trace.stack_trace_serial(), stack_trace.thread_serial(), frame_ids)
            }
            RecordTag::HeapDump | RecordTag::HeapDumpSegment => {
                format!("Heap Dump Segment (use summary for details)")
            }
            _ => format!("Record Tag: {:?}", record.tag()),
        };

        Ok(JsValue::from_str(&detail))
    }

    pub fn get_heap_dump_summary(&self, index: usize) -> Result<JsValue, JsValue> {
        let offset = *self.record_offsets.get(index).ok_or_else(|| JsValue::from_str("Record index out of bounds"))?;
        let length = u32::from_be_bytes(self.data[offset + 5..offset + 9].try_into().map_err(|_| "Invalid offset data")?) as usize;

        let mut mini_data = Vec::with_capacity(self.header_len + 9 + length);
        mini_data.extend_from_slice(&self.data[..self.header_len]);
        mini_data.extend_from_slice(&self.data[offset..offset + 9 + length]);

        let hprof = parse_hprof(&mini_data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let record = hprof.records_iter().next()
            .ok_or_else(|| JsValue::from_str("Failed to parse record"))?
            .map_err(|e| JsValue::from_str(&format!("Error parsing record: {:?}", e)))?;

        if let Some(segment_res) = record.as_heap_dump_segment() {
            let segment = segment_res.map_err(|e| JsValue::from_str(&format!("Error parsing heap dump segment: {:?}", e)))?;
            let mut counts = std::collections::HashMap::new();
            for sub_record in segment.sub_records() {
                let sub_record = match sub_record {
                    Ok(r) => r,
                    Err(e) => {
                        web_sys::console::log_1(&format!("Error parsing heap dump sub-record: {:?}", e).into());
                        continue;
                    }
                };
                let tag_name = match sub_record {
                    jvm_hprof::heap_dump::SubRecord::GcRootUnknown(_) => "GcRootUnknown",
                    jvm_hprof::heap_dump::SubRecord::GcRootJniGlobal(_) => "GcRootJniGlobal",
                    jvm_hprof::heap_dump::SubRecord::GcRootJniLocalRef(_) => "GcRootJniLocalRef",
                    jvm_hprof::heap_dump::SubRecord::GcRootJavaStackFrame(_) => "GcRootJavaStackFrame",
                    jvm_hprof::heap_dump::SubRecord::GcRootNativeStack(_) => "GcRootNativeStack",
                    jvm_hprof::heap_dump::SubRecord::GcRootSystemClass(_) => "GcRootSystemClass",
                    jvm_hprof::heap_dump::SubRecord::GcRootThreadBlock(_) => "GcRootThreadBlock",
                    jvm_hprof::heap_dump::SubRecord::GcRootBusyMonitor(_) => "GcRootBusyMonitor",
                    jvm_hprof::heap_dump::SubRecord::GcRootThreadObj(_) => "GcRootThreadObj",
                    jvm_hprof::heap_dump::SubRecord::Class(_) => "Class",
                    jvm_hprof::heap_dump::SubRecord::Instance(_) => "Instance",
                    jvm_hprof::heap_dump::SubRecord::ObjectArray(_) => "ObjectArray",
                    jvm_hprof::heap_dump::SubRecord::PrimitiveArray(_) => "PrimitiveArray",
                };
                *counts.entry(tag_name.to_string()).or_insert(0) += 1;
            }
            let mut summary: Vec<HeapSummaryEntry> = counts.into_iter()
                .map(|(tag, count)| HeapSummaryEntry { tag, count })
                .collect();
            summary.sort_by(|a, b| b.count.cmp(&a.count));
            Ok(serde_wasm_bindgen::to_value(&summary)?)
        } else {
            Err(JsValue::from_str("Record is not a heap dump"))
        }
    }

    pub fn get_heap_dump_records(&self, index: usize, offset: usize, limit: usize) -> Result<JsValue, JsValue> {
        let rec_offset = *self.record_offsets.get(index).ok_or_else(|| JsValue::from_str("Record index out of bounds"))?;
        let length = u32::from_be_bytes(self.data[rec_offset + 5..rec_offset + 9].try_into().map_err(|_| "Invalid offset data")?) as usize;

        let mut mini_data = Vec::with_capacity(self.header_len + 9 + length);
        mini_data.extend_from_slice(&self.data[..self.header_len]);
        mini_data.extend_from_slice(&self.data[rec_offset..rec_offset + 9 + length]);

        let hprof = parse_hprof(&mini_data).map_err(|e| JsValue::from_str(&format!("Error parsing hprof: {:?}", e)))?;
        let record = hprof.records_iter().next()
            .ok_or_else(|| JsValue::from_str("Failed to parse record"))?
            .map_err(|e| JsValue::from_str(&format!("Error parsing record: {:?}", e)))?;

        if let Some(segment_res) = record.as_heap_dump_segment() {
            let segment = segment_res.map_err(|e| JsValue::from_str(&format!("Error parsing heap dump segment: {:?}", e)))?;
            let mut sub_records = Vec::new();
            for (i, sub_record) in segment.sub_records().enumerate() {
                if i < offset { continue; }
                if i >= offset + limit { break; }
                let sub_record = sub_record.map_err(|e| JsValue::from_str(&format!("Error parsing heap dump sub-record: {:?}", e)))?;
                sub_records.push(format!("{:#?}", sub_record));
            }
            Ok(serde_wasm_bindgen::to_value(&sub_records)?)
        } else {
            Err(JsValue::from_str("Record is not a heap dump"))
        }
    }
}
