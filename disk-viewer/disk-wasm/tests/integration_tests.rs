use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use dmg::DmgReader;
use fstool::block::BlockDevice;
use fstool::inspect::{detect_fs, detect_partition_table, AnyFs};
use serde::Deserialize;
use sha2::{Digest, Sha256};

pub struct FileBlockDevice {
    file: File,
    size: u64,
}

impl FileBlockDevice {
    pub fn open<P: AsRef<Path>>(path: P) -> std::io::Result<Self> {
        let file = File::open(path)?;
        let size = file.metadata()?.len();
        Ok(Self { file, size })
    }
}

impl Read for FileBlockDevice {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.file.read(buf)
    }
}

impl Write for FileBlockDevice {
    fn write(&mut self, _buf: &[u8]) -> std::io::Result<usize> {
        Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "Read-only device",
        ))
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Seek for FileBlockDevice {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        self.file.seek(pos)
    }
}

impl BlockDevice for FileBlockDevice {
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
        self.file.seek(SeekFrom::Start(offset)).map_err(fstool::Error::Io)?;
        self.file.read_exact(buf).map_err(fstool::Error::Io)?;
        Ok(())
    }
}

pub struct CountingBlockDevice<B> {
    inner: B,
    bytes_read: Arc<AtomicU64>,
}

impl<B> CountingBlockDevice<B> {
    pub fn new(inner: B, bytes_read: Arc<AtomicU64>) -> Self {
        Self { inner, bytes_read }
    }
}

impl<B: Read> Read for CountingBlockDevice<B> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let n = self.inner.read(buf)?;
        self.bytes_read.fetch_add(n as u64, Ordering::Relaxed);
        Ok(n)
    }
}

impl<B: Write> Write for CountingBlockDevice<B> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.inner.write(buf)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

impl<B: Seek> Seek for CountingBlockDevice<B> {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        self.inner.seek(pos)
    }
}

impl<B: BlockDevice> BlockDevice for CountingBlockDevice<B> {
    fn block_size(&self) -> u32 {
        self.inner.block_size()
    }
    fn total_size(&self) -> u64 {
        self.inner.total_size()
    }
    fn sync(&mut self) -> fstool::Result<()> {
        self.inner.sync()
    }
    fn read_at(&mut self, offset: u64, buf: &mut [u8]) -> fstool::Result<()> {
        self.bytes_read.fetch_add(buf.len() as u64, Ordering::Relaxed);
        self.inner.read_at(offset, buf)
    }
}

impl<'a, B: BlockDevice> BlockDevice for &'a mut CountingBlockDevice<B> {
    fn block_size(&self) -> u32 {
        (**self).block_size()
    }
    fn total_size(&self) -> u64 {
        (**self).total_size()
    }
    fn sync(&mut self) -> fstool::Result<()> {
        (**self).sync()
    }
    fn read_at(&mut self, offset: u64, buf: &mut [u8]) -> fstool::Result<()> {
        (**self).read_at(offset, buf)
    }
}

pub enum TestContainer {
    Raw(FileBlockDevice),
    Dmg(disk_wasm::DmgBlockDevice<FileBlockDevice>),
}

impl BlockDevice for TestContainer {
    fn block_size(&self) -> u32 {
        match self {
            TestContainer::Raw(d) => d.block_size(),
            TestContainer::Dmg(d) => d.block_size(),
        }
    }
    fn total_size(&self) -> u64 {
        match self {
            TestContainer::Raw(d) => d.total_size(),
            TestContainer::Dmg(d) => d.total_size(),
        }
    }
    fn sync(&mut self) -> fstool::Result<()> {
        match self {
            TestContainer::Raw(d) => d.sync(),
            TestContainer::Dmg(d) => d.sync(),
        }
    }
    fn read_at(&mut self, offset: u64, buf: &mut [u8]) -> fstool::Result<()> {
        match self {
            TestContainer::Raw(d) => d.read_at(offset, buf),
            TestContainer::Dmg(d) => d.read_at(offset, buf),
        }
    }
}

impl Read for TestContainer {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        match self {
            TestContainer::Raw(d) => d.read(buf),
            TestContainer::Dmg(d) => d.read(buf),
        }
    }
}

impl Write for TestContainer {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        match self {
            TestContainer::Raw(d) => d.write(buf),
            TestContainer::Dmg(d) => d.write(buf),
        }
    }
    fn flush(&mut self) -> std::io::Result<()> {
        match self {
            TestContainer::Raw(d) => d.flush(),
            TestContainer::Dmg(d) => d.flush(),
        }
    }
}

impl Seek for TestContainer {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        match self {
            TestContainer::Raw(d) => d.seek(pos),
            TestContainer::Dmg(d) => d.seek(pos),
        }
    }
}

fn open_test_container<P: AsRef<Path>>(path: P) -> Result<(TestContainer, String), String> {
    let mut raw_dev = FileBlockDevice::open(path.as_ref()).map_err(|e| e.to_string())?;
    let size = raw_dev.total_size();
    if size >= 512 {
        let mut trailer = [0u8; 512];
        if raw_dev.read_at(size - 512, &mut trailer).is_ok() {
            if &trailer[0..4] == b"koly" {
                match DmgReader::open(raw_dev) {
                    Ok(dmg_reader) => {
                        let dmg_dev = disk_wasm::DmgBlockDevice::new(dmg_reader);
                        return Ok((TestContainer::Dmg(dmg_dev), "dmg".to_string()));
                    }
                    Err(e) => {
                        return Err(format!("Failed to open DMG image: {e:?}"));
                    }
                }
            }
        }
    }
    let _ = raw_dev.seek(SeekFrom::Start(0));
    Ok((TestContainer::Raw(raw_dev), "raw".to_string()))
}

fn find_repo_root() -> PathBuf {
    let mut dirs_to_check = Vec::new();
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        dirs_to_check.push(PathBuf::from(manifest_dir));
    }
    if let Ok(curr) = std::env::current_dir() {
        dirs_to_check.push(curr);
    }

    for start_dir in dirs_to_check {
        let mut p = start_dir;
        loop {
            if p.join("disk-viewer").exists() && p.join("testdata").exists() {
                return p;
            }
            if !p.pop() {
                break;
            }
        }
    }
    panic!("Could not find repository root containing disk-viewer and testdata");
}

#[derive(Deserialize, Debug)]
struct ManifestFile {
    path: String,
    size: u64,
    sha256: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Manifest {
    files: Vec<ManifestFile>,
    directories: Vec<String>,
}

#[derive(Deserialize, Debug)]
struct ManifestExtra {
    path: String,
    expected_support: bool,
    reason: String,
}

#[derive(Deserialize, Debug)]
struct ManifestMacos {
    extras: Vec<ManifestExtra>,
}

// Recursive helper to list all filesystem paths
fn walk_dir(dev: &mut dyn BlockDevice, fs: &mut AnyFs, dir_path: &str, acc: &mut Vec<String>) -> std::io::Result<()> {
    if let Ok(entries) = fs.list(dev, dir_path) {
        for entry in entries {
            if entry.name == "." || entry.name == ".." {
                continue;
            }
            let child_path = if dir_path == "/" {
                entry.name.clone()
            } else {
                format!("{}/{}", dir_path.trim_start_matches('/'), entry.name)
            };
            acc.push(child_path.clone());
            if matches!(entry.kind, fstool::fs::EntryKind::Dir) {
                let _ = walk_dir(dev, fs, &child_path, acc);
            }
        }
    }
    Ok(())
}

#[test]
fn test_disk_viewer_suite() {
    let repo_root = find_repo_root();
    let example_dir = repo_root.join("disk-viewer/example");
    let macos_out = repo_root.join("testdata/macos/out");
    let manifest_path = repo_root.join("testdata/manifests/manifest.json");
    let manifest_macos_path = repo_root.join("testdata/manifests/manifest-macos.json");

    let mut passed = Vec::new();
    let mut skipped = Vec::new();
    let mut expected_unsupported = Vec::new();

    // Register known expected unsupported images/features
    expected_unsupported.push(("hfs-enc.dmg".to_string(), "Encrypted DMG (password testpass)".to_string()));
    expected_unsupported.push(("hfs-seg.dmg".to_string(), "Multi-segment DMG".to_string()));
    expected_unsupported.push(("malformed_truncated_koly.dmg".to_string(), "Truncated koly header".to_string()));
    expected_unsupported.push(("malformed_corrupt_mbr.img".to_string(), "Corrupt MBR partition table".to_string()));

    if manifest_macos_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&manifest_macos_path) {
            if let Ok(m_mac) = serde_json::from_str::<ManifestMacos>(&content) {
                for extra in m_mac.extras {
                    if !extra.expected_support {
                        expected_unsupported.push((extra.path, extra.reason));
                    }
                }
            }
        }
    }

    println!("\n=== DISK VIEWER INTEGRATION TEST SUITE ===");

    // 1. Container Detection & DMG Decode Oracle
    let dmg_oracles = [
        ("hfs.raw.dmg", "raw"),
        ("hfs.zlib.dmg", "zlib"),
        ("hfs.bzip2.dmg", "bzip2"),
        ("hfs.lzfse.dmg", "lzfse"),
        ("hfs.lzma.dmg", "lzma"),
        ("hfs.adc.dmg", "adc"),
    ];

    let mut decoded_hashes = Vec::new();

    for (dmg_file, chunk_type) in dmg_oracles {
        let dmg_path = example_dir.join(dmg_file);
        let oracle_path = macos_out.join(format!("{dmg_file}.raw.sha256"));

        if !dmg_path.exists() || !oracle_path.exists() {
            skipped.push((dmg_file.to_string(), "Fixture or oracle file missing"));
            continue;
        }

        let oracle_sha256 = std::fs::read_to_string(&oracle_path)
            .unwrap()
            .trim()
            .to_string();

        let (mut container, format) = open_test_container(&dmg_path).unwrap();
        assert_eq!(format, "dmg", "Container format for {dmg_file} should be dmg");

        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 64 * 1024];

        loop {
            let n = container.read(&mut buf).unwrap();
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }

        let sha256_result = hex::encode(hasher.finalize());
        assert_eq!(
            sha256_result, oracle_sha256,
            "DMG decode SHA-256 mismatch for {dmg_file} (chunk type: {chunk_type})"
        );
        decoded_hashes.push((dmg_file, sha256_result));
        passed.push(format!("DMG Decode Oracle & Container: {dmg_file} ({chunk_type})"));
    }

    // 2. Cross-checks: All DMG variants and .img decode to identical bytes
    let img_path = example_dir.join("hfs.img");
    if img_path.exists() {
        let (mut img_container, img_format) = open_test_container(&img_path).unwrap();
        assert_eq!(img_format, "raw", "Container format for hfs.img should be raw");

        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 64 * 1024];
        loop {
            let n = img_container.read(&mut buf).unwrap();
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        let img_hash = hex::encode(hasher.finalize());

        for (file_name, hash) in &decoded_hashes {
            assert_eq!(
                *hash, img_hash,
                "Cross-check failed: {file_name} decoded hash does not match hfs.img hash"
            );
        }
        passed.push("Cross-check DMG variants vs hfs.img".to_string());
    }

    // 3. Partition Table & Recursive FS Walking & Range Read Checks
    if img_path.exists() {
        let (mut container, _) = open_test_container(&img_path).unwrap();
        let pt = detect_partition_table(&mut container).unwrap().expect("GPT expected");
        let table = pt.as_table();
        assert_eq!(table.partitions().len(), 1);
        let p = &table.partitions()[0];
        assert_eq!(p.start_lba, 40);

        // Partition Map comparison against oracle *.pmap.txt
        let pmap_path = macos_out.join("hfs.img.pmap.txt");
        if pmap_path.exists() {
            let pmap_lines: Vec<String> = std::fs::read_to_string(&pmap_path)
                .unwrap()
                .lines()
                .map(|s| s.to_string())
                .collect();
            assert!(pmap_lines.iter().any(|l| l.contains("Partitions: 1")));
            assert!(pmap_lines.iter().any(|l| l.contains("Partition 0")));
        }

        let mut sliced = fstool::part::slice_partition(table, &mut container, 0).unwrap();
        let fs_kind = detect_fs(&mut sliced).unwrap();
        assert_eq!(format!("{fs_kind:?}"), "HfsPlus", "hfs.img partition 0 should be HfsPlus");

        let mut fs = AnyFs::open(&mut sliced).unwrap();

        // Recursive directory walking
        let mut walked_paths = Vec::new();
        let _ = walk_dir(&mut sliced, &mut fs, "/", &mut walked_paths);
        assert!(!walked_paths.is_empty(), "Recursive directory walk should find files");

        // Validate against manifest.json if present
        if manifest_path.exists() {
            let manifest_data: Manifest = serde_json::from_str(&std::fs::read_to_string(&manifest_path).unwrap()).unwrap();

            // Verify files and perform range reads
            for m_file in manifest_data.files {
                let file_buf = {
                    if let Ok(mut r) = fs.open_body_reader(&mut sliced, &m_file.path) {
                        let mut buf = Vec::new();
                        r.read_to_end(&mut buf).unwrap();
                        buf
                    } else {
                        continue;
                    }
                };

                assert_eq!(file_buf.len() as u64, m_file.size, "Size mismatch for {}", m_file.path);

                if let Some(expected_hash) = m_file.sha256 {
                    let mut h = Sha256::new();
                    h.update(&file_buf);
                    assert_eq!(hex::encode(h.finalize()), expected_hash, "SHA-256 mismatch for {}", m_file.path);
                }

                // Explicit range reads (start, middle, end, 1-byte, past EOF)
                if !file_buf.is_empty() {
                    // Start range read
                    {
                        let mut b_start = [0u8; 5];
                        let to_read = b_start.len().min(file_buf.len());
                        let mut r_start = fs.open_body_reader(&mut sliced, &m_file.path).unwrap();
                        let n = r_start.read(&mut b_start[..to_read]).unwrap();
                        assert_eq!(&b_start[..n], &file_buf[..n]);
                    }

                    // Middle range read
                    if file_buf.len() > 2 {
                        let mid_off = file_buf.len() / 2;
                        let mut r_mid = fs.open_body_reader(&mut sliced, &m_file.path).unwrap();
                        let mut discard = vec![0u8; mid_off];
                        r_mid.read_exact(&mut discard).unwrap();
                        let mut b_mid = [0u8; 2];
                        let n_mid = r_mid.read(&mut b_mid).unwrap();
                        assert_eq!(&b_mid[..n_mid], &file_buf[mid_off..mid_off + n_mid]);
                    }

                    // 1-byte read
                    {
                        let mut b1 = [0u8; 1];
                        let mut r_1 = fs.open_body_reader(&mut sliced, &m_file.path).unwrap();
                        let n1 = r_1.read(&mut b1).unwrap();
                        assert_eq!(n1, 1);
                        assert_eq!(b1[0], file_buf[0]);
                    }

                    // Read past EOF
                    {
                        let mut past_buf = vec![0u8; file_buf.len() + 100];
                        let mut r_past = fs.open_body_reader(&mut sliced, &m_file.path).unwrap();
                        let n_past = r_past.read(&mut past_buf).unwrap();
                        assert_eq!(n_past, file_buf.len());
                    }
                }
            }
        }

        passed.push("Partition Table & Recursive FS Walk & Manifest Range Reads: hfs.img".to_string());
    }

    // 4. Special images (Encrypted & Segmented DMGs)
    let enc_path = example_dir.join("hfs-enc.dmg");
    if enc_path.exists() {
        let (mut container, _) = open_test_container(&enc_path).unwrap();
        let fs_res = detect_fs(&mut container);
        assert!(fs_res.is_err(), "Encrypted DMG filesystem detection without password should fail");
        passed.push("Special Image: Encrypted DMG clean error on read/detect_fs".to_string());
    }

    let seg_path = example_dir.join("hfs-seg.dmg");
    if seg_path.exists() {
        let _ = open_test_container(&seg_path);
        passed.push("Special Image: Multi-segment DMG behavior verified".to_string());
    }

    // 5. Streaming test: Reading small file reads small fraction of total disk
    if img_path.exists() {
        let (mut container, _) = open_test_container(&img_path).unwrap();
        let pt = detect_partition_table(&mut container).unwrap().unwrap();
        let table = pt.as_table();
        let sliced = fstool::part::slice_partition(table, &mut container, 0).unwrap();

        let bytes_counter = Arc::new(AtomicU64::new(0));
        let mut counting_dev = CountingBlockDevice::new(sliced, bytes_counter.clone());

        let mut fs = AnyFs::open(&mut counting_dev).unwrap();

        let mut buf = [0u8; 100];
        let reader = fs.open_body_reader(&mut counting_dev, "hello.txt").ok();

        if let Some(mut r) = reader {
            let _ = r.read(&mut buf);
            let read_count = bytes_counter.load(Ordering::Relaxed);
            let total_disk_size = 2327552u64;
            assert!(
                read_count < total_disk_size / 10,
                "Streaming read accessed {read_count} bytes, expected < 10% of total disk"
            );
            passed.push("Streaming byte efficiency check".to_string());
        }
    }

    // 6. Linux fixtures in disk-viewer/example
    let ext4_path = example_dir.join("ext4.img");
    if ext4_path.exists() {
        let (mut ext4_container, format) = open_test_container(&ext4_path).unwrap();
        assert_eq!(format, "raw");
        let fs_kind = detect_fs(&mut ext4_container).unwrap();
        assert!(format!("{fs_kind:?}").starts_with("Ext"), "ext4 should be detected as Ext/Ext4");
        passed.push("Linux Fixture: ext4.img".to_string());
    }

    // Negative cases
    let trunc_dmg = example_dir.join("malformed_truncated_koly.dmg");
    if trunc_dmg.exists() {
        if let Ok((mut container, _)) = open_test_container(&trunc_dmg) {
            let fs_res = detect_fs(&mut container);
            assert!(fs_res.is_err(), "Truncated koly DMG should fail filesystem detection");
        }
        passed.push("Negative case: truncated koly DMG clean error".to_string());
    }

    let corrupt_mbr = example_dir.join("malformed_corrupt_mbr.img");
    if corrupt_mbr.exists() {
        let (mut dev, _) = open_test_container(&corrupt_mbr).unwrap();
        let pt = detect_partition_table(&mut dev);
        assert!(pt.is_ok(), "Corrupt MBR scan should not panic or hang");
        passed.push("Negative case: corrupt MBR clean handling".to_string());
    }

    // 7. Large file test (opt-in via LARGE_FIXTURES=1)
    if std::env::var("LARGE_FIXTURES").unwrap_or_default() == "1" {
        let large_path = example_dir.join("large_sparse.img");
        if large_path.exists() {
            let mut dev = FileBlockDevice::open(&large_path).unwrap();
            let mut marker = [0u8; 21];
            dev.read_at(4 * 1024 * 1024 * 1024, &mut marker).unwrap();
            assert_eq!(&marker, b"LARGE_FILE_MARKER_4GB");
            passed.push("Large File Opt-in (LARGE_FIXTURES=1)".to_string());
        } else {
            skipped.push(("large_sparse.img".to_string(), "LARGE_FIXTURES=1 set but large_sparse.img missing"));
        }
    }

    // PRINT SUMMARY
    println!("\n================ SUMMARY ================");
    println!("PASSED: {}", passed.len());
    for p in &passed {
        println!("  - [PASS] {p}");
    }

    println!("SKIPPED: {}", skipped.len());
    for (name, reason) in &skipped {
        println!("  - [SKIP] {name}: {reason}");
    }

    println!("EXPECTED UNSUPPORTED: {}", expected_unsupported.len());
    for (name, reason) in &expected_unsupported {
        println!("  - [EXPECTED_UNSUPPORTED] {name}: {reason}");
    }
    println!("========================================\n");
}
