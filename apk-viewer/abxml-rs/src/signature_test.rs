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

    #[test]
    fn test_signature_extraction_real_apk() {
        let path = "../../tests/fixtures/Tasker.6.6.20.apk";
        let bytes = std::fs::read(path).expect("Could not read Tasker APK");
        let dummy_arsc = vec![2, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        let mut apk = Apk::<std::io::Cursor<&[u8]>>::from_bytes(&bytes).expect("Failed to load APK");
        let metadata = apk.get_metadata_with_bytes(&bytes, &dummy_arsc).expect("Failed to get metadata");

        // Based on the user's apksigner output:
        // Verified using v2 scheme (APK Signature Scheme v2): true
        assert!(metadata.v2_signature, "V2 signature should be detected");
        assert!(!metadata.v1_signature, "V1 signature should NOT be detected (as per apksigner output)");

        assert!(!metadata.signers.is_empty(), "Should have at least one signer");
        let signer = &metadata.signers[0];

        // apksigner output:
        // Signer #1 certificate DN: CN=Lee Wilmot, OU=Unknown, O=Unknown, L=Unknown, ST=Unknown, C=Unknown
        // Signer #1 certificate SHA-256 digest: 973fe25b9be28fb7436d49582b04277767c852539be31783d134a55621b6636d
        // Signer #1 certificate SHA-1 digest: feadd18b23781cfd4eac71118c76fb35c1ab39c7
        // Signer #1 certificate MD5 digest: 39a8d78a20654f15b953c1783ebb0c63

        assert_eq!(signer.sha256_digest, "973fe25b9be28fb7436d49582b04277767c852539be31783d134a55621b6636d");
        assert_eq!(signer.sha1_digest, "feadd18b23781cfd4eac71118c76fb35c1ab39c7");
        assert_eq!(signer.md5_digest, "39a8d78a20654f15b953c1783ebb0c63");
        assert!(signer.subject.contains("CN=Lee Wilmot"), "Subject should contain Lee Wilmot");
    }
}
