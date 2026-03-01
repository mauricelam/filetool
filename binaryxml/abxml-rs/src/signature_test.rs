#[cfg(test)]
mod tests {
    use crate::apk::Apk;
    use std::collections::HashMap;

    #[test]
    fn test_find_signing_block_mock() {
        let mut bytes = vec![0u8; 1000];
        // Central Directory at 800
        let cd_offset = 800;
        // EOCD at 900
        let eocd_pos = 900;
        bytes[eocd_pos..eocd_pos+4].copy_from_slice(b"\x50\x4b\x05\x06");
        bytes[eocd_pos+16..eocd_pos+20].copy_from_slice(&(cd_offset as u32).to_le_bytes());

        // Signing Block right before CD
        // Block size: 40 (8 size + 8 size + 8 magic + 16 pair)
        let block_size: u64 = 40;
        let block_start = cd_offset - 8 - block_size as usize;
        bytes[block_start..block_start+8].copy_from_slice(&block_size.to_le_bytes());
        bytes[cd_offset-24..cd_offset-16].copy_from_slice(&block_size.to_le_bytes());
        bytes[cd_offset-16..cd_offset].copy_from_slice(b"APK Sig Block 42");

        // Pair: ID 0x7109871a, value b"test"
        // Pair size: 4 (ID) + 4 (value) = 8
        let pair_pos = block_start + 8;
        let pair_size: u64 = 8;
        bytes[pair_pos..pair_pos+8].copy_from_slice(&pair_size.to_le_bytes());
        bytes[pair_pos+8..pair_pos+12].copy_from_slice(&0x7109871a_u32.to_le_bytes());
        bytes[pair_pos+12..pair_pos+16].copy_from_slice(b"test");

        let result = Apk::<std::io::Cursor<&[u8]>>::find_signing_block_for_test(&bytes).unwrap();
        assert!(result.contains_key(&0x7109871a));
        assert_eq!(result.get(&0x7109871a).unwrap(), b"test");
    }
}
