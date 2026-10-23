use std::io::{Read, Write, Seek, SeekFrom};
use wasm_bindgen::prelude::*;
use fstool::block::BlockDevice;
use fstool::part::{slice_partition, PartitionKind};
use fstool::inspect::{detect_partition_table, AnyFs};
use fstool::fs::EntryKind;
use dmg::DmgReader;
use serde::Serialize;
use tsify::Tsify;

#[wasm_bindgen]
extern "C" {
    pub type JsFileBackend;

    #[wasm_bindgen(method, getter)]
    fn size(this: &JsFileBackend) -> f64;

    #[wasm_bindgen(method, js_name = readAt, catch)]
    fn read_at(this: &JsFileBackend, offset: f64, length: f64) -> Result<js_sys::Uint8Array, JsValue>;
}

pub struct JsBlockDevice {
    js_backend: JsFileBackend,
    pos: u64,
    size: u64,
}

impl JsBlockDevice {
    pub fn new(js_backend: JsFileBackend) -> Self {
        let size = js_backend.size() as u64;
        Self { js_backend, pos: 0, size }
    }
}

unsafe impl Send for JsBlockDevice {}
unsafe impl Sync for JsBlockDevice {}

impl Read for JsBlockDevice {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if self.pos >= self.size {
            return Ok(0);
        }
        let to_read = (buf.len() as u64).min(self.size - self.pos);
        if to_read == 0 {
            return Ok(0);
        }
        let uint8_array = self
            .js_backend
            .read_at(self.pos as f64, to_read as f64)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, format!("{:?}", e)))?;
        let len = uint8_array.length() as usize;
        uint8_array.copy_to(&mut buf[..len]);
        self.pos += len as u64;
        Ok(len)
    }
}

impl Write for JsBlockDevice {
    fn write(&mut self, _buf: &[u8]) -> std::io::Result<usize> {
        Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "Read-only block device"))
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Seek for JsBlockDevice {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        let new_pos = match pos {
            SeekFrom::Start(off) => off as i64,
            SeekFrom::Current(off) => self.pos as i64 + off,
            SeekFrom::End(off) => self.size as i64 + off,
        };
        if new_pos < 0 {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "negative seek position"));
        }
        self.pos = new_pos as u64;
        Ok(self.pos)
    }
}

impl BlockDevice for JsBlockDevice {
    fn block_size(&self) -> u32 {
        512
    }
    fn total_size(&self) -> u64 {
        self.size
    }
    fn sync(&mut self) -> fstool::Result<()> {
        Ok(())
    }
    fn read_at(&mut self, offset: u64, buf: &mut [u8]) -> fstool::Result<()> {
        if offset + buf.len() as u64 > self.size {
            return Err(fstool::Error::OutOfBounds { offset, len: buf.len() as u64, size: self.size });
        }
        if buf.is_empty() {
            return Ok(());
        }
        let uint8_array = self
            .js_backend
            .read_at(offset as f64, buf.len() as f64)
            .map_err(|e| fstool::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("{:?}", e))))?;
        uint8_array.copy_to(buf);
        Ok(())
    }
}

pub struct DmgBlockDevice<R: Read + Seek + Send> {
    inner: DmgReader<R>,
}

impl<R: Read + Seek + Send> DmgBlockDevice<R> {
    pub fn new(inner: DmgReader<R>) -> Self {
        Self { inner }
    }
}

impl<R: Read + Seek + Send> Read for DmgBlockDevice<R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.inner.read(buf)
    }
}

impl<R: Read + Seek + Send> Write for DmgBlockDevice<R> {
    fn write(&mut self, _buf: &[u8]) -> std::io::Result<usize> {
        Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "Read-only device"))
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl<R: Read + Seek + Send> Seek for DmgBlockDevice<R> {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        self.inner.seek(pos)
    }
}

impl<R: Read + Seek + Send> BlockDevice for DmgBlockDevice<R> {
    fn block_size(&self) -> u32 {
        512
    }
    fn total_size(&self) -> u64 {
        self.inner.virtual_disk_size()
    }
    fn sync(&mut self) -> fstool::Result<()> {
        Ok(())
    }
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct PartitionInfo {
    pub index: usize,
    pub scheme: String,
    pub start_lba: u64,
    pub size_lba: u64,
    pub start_bytes: u64,
    pub size_bytes: u64,
    pub kind: String,
    pub name: Option<String>,
    pub fs_kind: Option<String>,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct DirEntryInfo {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub inode: u32,
    pub kind: String,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct DiskInfo {
    pub container_format: String,
    pub total_size: u64,
    pub partitions: Vec<PartitionInfo>,
}

enum DiskDevice {
    Raw(JsBlockDevice),
    Dmg(DmgBlockDevice<JsBlockDevice>),
}

impl BlockDevice for DiskDevice {
    fn block_size(&self) -> u32 {
        match self {
            DiskDevice::Raw(d) => d.block_size(),
            DiskDevice::Dmg(d) => d.block_size(),
        }
    }
    fn total_size(&self) -> u64 {
        match self {
            DiskDevice::Raw(d) => d.total_size(),
            DiskDevice::Dmg(d) => d.total_size(),
        }
    }
    fn sync(&mut self) -> fstool::Result<()> {
        match self {
            DiskDevice::Raw(d) => d.sync(),
            DiskDevice::Dmg(d) => d.sync(),
        }
    }
    fn read_at(&mut self, offset: u64, buf: &mut [u8]) -> fstool::Result<()> {
        match self {
            DiskDevice::Raw(d) => d.read_at(offset, buf),
            DiskDevice::Dmg(d) => d.read_at(offset, buf),
        }
    }
}

impl Read for DiskDevice {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        match self {
            DiskDevice::Raw(d) => d.read(buf),
            DiskDevice::Dmg(d) => d.read(buf),
        }
    }
}

impl Write for DiskDevice {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        match self {
            DiskDevice::Raw(d) => d.write(buf),
            DiskDevice::Dmg(d) => d.write(buf),
        }
    }
    fn flush(&mut self) -> std::io::Result<()> {
        match self {
            DiskDevice::Raw(d) => d.flush(),
            DiskDevice::Dmg(d) => d.flush(),
        }
    }
}

impl Seek for DiskDevice {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        match self {
            DiskDevice::Raw(d) => d.seek(pos),
            DiskDevice::Dmg(d) => d.seek(pos),
        }
    }
}

fn open_container(mut raw_dev: JsBlockDevice) -> Result<(DiskDevice, String), String> {
    let size = raw_dev.total_size();
    if size >= 512 {
        let mut header = [0u8; 8];
        if raw_dev.read_at(0, &mut header).is_ok() {
            if &header[0..4] == b"QFI\xef" || &header[0..4] == b"QFI\xfb" {
                return Err("QCOW2 disk images are not supported".to_string());
            }
            if &header[0..4] == b"LUKS" {
                return Err("Encrypted LUKS volumes are not supported".to_string());
            }
        }
        let mut trailer = [0u8; 512];
        if raw_dev.read_at(size - 512, &mut trailer).is_ok() {
            if &trailer[0..4] == b"koly" {
                match DmgReader::open(raw_dev) {
                    Ok(dmg_reader) => {
                        let dmg_dev = DmgBlockDevice::new(dmg_reader);
                        return Ok((DiskDevice::Dmg(dmg_dev), "dmg".to_string()));
                    }
                    Err(e) => {
                        return Err(format!("Failed to open DMG image (may be encrypted or unsupported): {e:?}"));
                    }
                }
            }
        }
    }
    Ok((DiskDevice::Raw(raw_dev), "raw".to_string()))
}

#[wasm_bindgen]
pub struct DiskSession {
    dev: DiskDevice,
    container_format: String,
}

fn format_partition_kind(kind: &PartitionKind) -> String {
    match kind {
        PartitionKind::Empty => "Empty".to_string(),
        PartitionKind::LinuxFilesystem => "LinuxFilesystem".to_string(),
        PartitionKind::LinuxSwap => "LinuxSwap".to_string(),
        PartitionKind::EfiSystem => "EfiSystem".to_string(),
        PartitionKind::BiosBoot => "BiosBoot".to_string(),
        PartitionKind::Fat32 => "Fat32".to_string(),
        PartitionKind::MicrosoftBasicData => "MicrosoftBasicData".to_string(),
        PartitionKind::Mbr(b) => format!("MBR(0x{b:02X})"),
        PartitionKind::Gpt(u) => format!("GPT({u})"),
        PartitionKind::Apm(s) => format!("APM({s})"),
    }
}

#[wasm_bindgen]
impl DiskSession {
    #[wasm_bindgen(constructor)]
    pub fn new(js_backend: JsFileBackend) -> Result<DiskSession, JsError> {
        let raw_dev = JsBlockDevice::new(js_backend);
        let (dev, container_format) = open_container(raw_dev).map_err(|e| JsError::new(&e))?;
        Ok(DiskSession { dev, container_format })
    }

    pub fn inspect(&mut self) -> Result<JsValue, JsError> {
        let total_size = self.dev.total_size();
        let mut partitions_info = Vec::new();

        if let Ok(Some(table)) = detect_partition_table(&mut self.dev) {
            let scheme = match &table {
                fstool::inspect::DetectedTable::Mbr(_) => "MBR",
                fstool::inspect::DetectedTable::Gpt(_) => "GPT",
                fstool::inspect::DetectedTable::Apm(_) => "APM",
            }.to_string();

            let pt = table.as_table();
            let block_size = self.dev.block_size() as u64;

            for (i, p) in pt.partitions().iter().enumerate() {
                let start_bytes = p.start_lba * block_size;
                let size_bytes = p.size_lba * block_size;

                let fs_kind = if let Ok(mut sliced) = slice_partition(pt, &mut self.dev, i) {
                    fstool::inspect::detect_fs(&mut sliced).ok().map(|k| format!("{k:?}"))
                } else {
                    None
                };

                partitions_info.push(PartitionInfo {
                    index: i,
                    scheme: scheme.clone(),
                    start_lba: p.start_lba,
                    size_lba: p.size_lba,
                    start_bytes,
                    size_bytes,
                    kind: format_partition_kind(&p.kind),
                    name: p.name.clone(),
                    fs_kind,
                });
            }
        } else {
            // Unpartitioned image
            let fs_kind = fstool::inspect::detect_fs(&mut self.dev).ok().map(|k| format!("{k:?}"));
            partitions_info.push(PartitionInfo {
                index: 0,
                scheme: "None".to_string(),
                start_lba: 0,
                size_lba: total_size / 512,
                start_bytes: 0,
                size_bytes: total_size,
                kind: "Volume".to_string(),
                name: None,
                fs_kind,
            });
        }

        let info = DiskInfo {
            container_format: self.container_format.clone(),
            total_size,
            partitions: partitions_info,
        };

        serde_wasm_bindgen::to_value(&info).map_err(|e| JsError::new(&e.to_string()))
    }

    pub fn list_dir(&mut self, partition_index: usize, is_partitioned: bool, path: &str) -> Result<JsValue, JsError> {
        let process_fs = |sliced_dev: &mut dyn BlockDevice| -> Result<JsValue, JsError> {
            let mut fs = AnyFs::open(sliced_dev)
                .map_err(|e| JsError::new(&format!("Failed to open filesystem: {e}")))?;
            let entries = fs.list(sliced_dev, path)
                .map_err(|e| JsError::new(&format!("Failed to list directory '{path}': {e}")))?;
            let mut res = Vec::new();
            for e in entries {
                if e.name == "." || e.name == ".." {
                    continue;
                }
                let is_dir = matches!(e.kind, EntryKind::Dir);
                let kind_str = match e.kind {
                    EntryKind::Dir => "dir".to_string(),
                    EntryKind::Regular => "file".to_string(),
                    EntryKind::Symlink => "symlink".to_string(),
                    _ => "other".to_string(),
                };
                res.push(DirEntryInfo {
                    name: e.name,
                    is_dir,
                    size: e.size,
                    inode: e.inode,
                    kind: kind_str,
                });
            }
            serde_wasm_bindgen::to_value(&res).map_err(|e| JsError::new(&e.to_string()))
        };

        if is_partitioned {
            let table = detect_partition_table(&mut self.dev)
                .map_err(|e| JsError::new(&e.to_string()))?
                .ok_or_else(|| JsError::new("No partition table found"))?;
            let pt = table.as_table();
            let mut sliced = slice_partition(pt, &mut self.dev, partition_index)
                .map_err(|e| JsError::new(&e.to_string()))?;
            process_fs(&mut sliced)
        } else {
            process_fs(&mut self.dev)
        }
    }

    pub fn read_file_range(&mut self, partition_index: usize, is_partitioned: bool, path: &str, offset: u64, length: u64) -> Result<js_sys::Uint8Array, JsError> {
        let read_fs = |sliced_dev: &mut dyn BlockDevice| -> Result<js_sys::Uint8Array, JsError> {
            let mut fs = AnyFs::open(sliced_dev)
                .map_err(|e| JsError::new(&format!("Failed to open filesystem: {e}")))?;
            let mut reader = fs.open_body_reader(sliced_dev, path)
                .map_err(|e| JsError::new(&format!("Failed to open file '{path}': {e}")))?;

            if offset > 0 {
                let mut skipped = 0u64;
                let mut discard = [0u8; 8192];
                while skipped < offset {
                    let to_read = (discard.len() as u64).min(offset - skipped) as usize;
                    let n = reader.read(&mut discard[..to_read])
                        .map_err(|e| JsError::new(&format!("Error seeking in file: {e}")))?;
                    if n == 0 {
                        break;
                    }
                    skipped += n as u64;
                }
            }

            let mut buf = vec![0u8; length as usize];
            let mut read_total = 0usize;
            while read_total < buf.len() {
                let n = reader.read(&mut buf[read_total..])
                    .map_err(|e| JsError::new(&format!("Error reading file: {e}")))?;
                if n == 0 {
                    break;
                }
                read_total += n;
            }
            buf.truncate(read_total);
            Ok(js_sys::Uint8Array::from(buf.as_slice()))
        };

        if is_partitioned {
            let table = detect_partition_table(&mut self.dev)
                .map_err(|e| JsError::new(&e.to_string()))?
                .ok_or_else(|| JsError::new("No partition table found"))?;
            let pt = table.as_table();
            let mut sliced = slice_partition(pt, &mut self.dev, partition_index)
                .map_err(|e| JsError::new(&e.to_string()))?;
            read_fs(&mut sliced)
        } else {
            read_fs(&mut self.dev)
        }
    }
}
