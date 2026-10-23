# `@filetool/disk-viewer`

Browser-based disk image viewer supporting DMG (UDIF) and raw `.img` / `.iso` / disk dumps using [`fstool`](https://github.com/KarpelesLab/fstool) and [`dmg-core`](https://github.com/SecurityRonin/dmg-forensic).

## Features

- **Container Detection**: Detects `.dmg` (UDIF koly trailer), `.img` / `.iso` / raw disk dumps, QCOW2, and LUKS.
- **Partition Table Schemes**: Supports MBR, GPT, APM partition tables and unpartitioned disk images.
- **Filesystem Support**: HFS+, APFS, ISO 9660, FAT12/16/32, exFAT, ext2/3/4, NTFS, SquashFS, F2FS, XFS, and others provided by `fstool`.
- **Memory Efficient**: Reads range-by-range synchronously in a Web Worker (`FileReaderSync`, `Blob.slice`) without loading entire files into WebAssembly memory.
- **File Extraction & Inspection**: Allows browsing directory trees, previewing file metadata, extracting/downloading files, and opening files in parent viewers.

## Architecture

- `disk-wasm`: Rust WebAssembly crate bridging `fstool` and `dmg-core` over a JS-backed `BlockDevice`.
- `worker.ts`: Web Worker running synchronous range reads via `FileReaderSync` and communicating via Web Worker message RPC.
- `main.tsx`: React frontend displaying partition dropdowns, metadata, and hierarchical directory browsing via `@filetool/components` (`ColumnView`).
