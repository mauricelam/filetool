pub fn opcode_to_name(code: u8) -> Option<(&'static str, &'static str, u32)> {
    match code {
        0x00 => Some(("nop", "10x", 16)),
        0x01 => Some(("move", "12x", 16)),
        0x02 => Some(("move/from16", "22x", 32)),
        0x03 => Some(("move/16", "32x", 48)),
        0x04 => Some(("move-wide", "12x", 16)),
        0x05 => Some(("move-wide/from16", "22x", 32)),
        0x06 => Some(("move-wide/16", "32x", 48)),
        0x07 => Some(("move-object", "12x", 16)),
        0x08 => Some(("move-object/from16", "22x", 32)),
        0x09 => Some(("move-object/16", "32x", 48)),
        0x0a => Some(("move-result", "11x", 16)),
        0x0b => Some(("move-result-wide", "11x", 16)),
        0x0c => Some(("move-result-object", "11x", 16)),
        0x0d => Some(("move-exception", "11x", 16)),
        0x0e => Some(("return-void", "10x", 16)),
        0x0f => Some(("return", "11x", 16)),
        0x10 => Some(("return-wide", "11x", 16)),
        0x11 => Some(("return-object", "11x", 16)),
        0x12 => Some(("const/4", "11n", 16)),
        0x13 => Some(("const/16", "21s", 32)),
        0x14 => Some(("const", "31i", 48)),
        0x15 => Some(("const/high16", "21h", 32)),
        0x16 => Some(("const-wide/16", "21s", 32)),
        0x17 => Some(("const-wide/32", "31i", 48)),
        0x18 => Some(("const-wide", "51l", 80)),
        0x19 => Some(("const-wide/high16", "21h", 32)),
        0x1a => Some(("const-string", "21c", 32)),
        0x1b => Some(("const-string/jumbo", "31c", 48)),
        0x1c => Some(("const-class", "21c", 32)),
        0x1d => Some(("monitor-enter", "11x", 16)),
        0x1e => Some(("monitor-exit", "11x", 16)),
        0x1f => Some(("check-cast", "21c", 32)),
        0x20 => Some(("instance-of", "22c", 32)),
        0x21 => Some(("array-length", "12x", 16)),
        0x22 => Some(("new-instance", "21c", 32)),
        0x23 => Some(("new-array", "22c", 32)),
        0x24 => Some(("filled-new-array", "35c", 48)),
        0x25 => Some(("filled-new-array/range", "3rc", 48)),
        0x26 => Some(("fill-array-data", "31t", 48)),
        0x27 => Some(("throw", "11x", 16)),
        0x28 => Some(("goto", "10t", 16)),
        0x29 => Some(("goto/16", "20t", 32)),
        0x2a => Some(("goto/32", "30t", 48)),
        0x2b => Some(("packed-switch", "31t", 48)),
        0x2c => Some(("sparse-switch", "31t", 48)),
        0x2d => Some(("cmpl-float", "23x", 32)),
        0x2e => Some(("cmpg-float", "23x", 32)),
        0x2f => Some(("cmpl-double", "23x", 32)),
        0x30 => Some(("cmpg-double", "23x", 32)),
        0x31 => Some(("cmp-long", "23x", 32)),
        0x32 => Some(("if-eq", "22t", 32)),
        0x33 => Some(("if-ne", "22t", 32)),
        0x34 => Some(("if-lt", "22t", 32)),
        0x35 => Some(("if-ge", "22t", 32)),
        0x36 => Some(("if-gt", "22t", 32)),
        0x37 => Some(("if-le", "22t", 32)),
        0x38 => Some(("if-eqz", "21t", 32)),
        0x39 => Some(("if-nez", "21t", 32)),
        0x3a => Some(("if-ltz", "21t", 32)),
        0x3b => Some(("if-gez", "21t", 32)),
        0x3c => Some(("if-gtz", "21t", 32)),
        0x3d => Some(("if-lez", "21t", 32)),
        0x44 => Some(("aget", "23x", 32)),
        0x45 => Some(("aget-wide", "23x", 32)),
        0x46 => Some(("aget-object", "23x", 32)),
        0x47 => Some(("aget-boolean", "23x", 32)),
        0x48 => Some(("aget-byte", "23x", 32)),
        0x49 => Some(("aget-char", "23x", 32)),
        0x4a => Some(("aget-short", "23x", 32)),
        0x4b => Some(("aput", "23x", 32)),
        0x4c => Some(("aput-wide", "23x", 32)),
        0x4d => Some(("aput-object", "23x", 32)),
        0x4e => Some(("aput-boolean", "23x", 32)),
        0x4f => Some(("aput-byte", "23x", 32)),
        0x50 => Some(("aput-char", "23x", 32)),
        0x51 => Some(("aput-short", "23x", 32)),
        0x52 => Some(("iget", "22c", 32)),
        0x53 => Some(("iget-wide", "22c", 32)),
        0x54 => Some(("iget-object", "22c", 32)),
        0x55 => Some(("iget-boolean", "22c", 32)),
        0x56 => Some(("iget-byte", "22c", 32)),
        0x57 => Some(("iget-char", "22c", 32)),
        0x58 => Some(("iget-short", "22c", 32)),
        0x59 => Some(("iput", "22c", 32)),
        0x5a => Some(("iput-wide", "22c", 32)),
        0x5b => Some(("iput-object", "22c", 32)),
        0x5c => Some(("iput-boolean", "22c", 32)),
        0x5d => Some(("iput-byte", "22c", 32)),
        0x5e => Some(("iput-char", "22c", 32)),
        0x5f => Some(("iput-short", "22c", 32)),
        0x60 => Some(("sget", "21c", 32)),
        0x61 => Some(("sget-wide", "21c", 32)),
        0x62 => Some(("sget-object", "21c", 32)),
        0x63 => Some(("sget-boolean", "21c", 32)),
        0x64 => Some(("sget-byte", "21c", 32)),
        0x65 => Some(("sget-char", "21c", 32)),
        0x66 => Some(("sget-short", "21c", 32)),
        0x67 => Some(("sput", "21c", 32)),
        0x68 => Some(("sput-wide", "21c", 32)),
        0x69 => Some(("sput-object", "21c", 32)),
        0x6a => Some(("sput-boolean", "21c", 32)),
        0x6b => Some(("sput-byte", "21c", 32)),
        0x6c => Some(("sput-char", "21c", 32)),
        0x6d => Some(("sput-short", "21c", 32)),
        0x6e => Some(("invoke-virtual", "35c", 48)),
        0x6f => Some(("invoke-super", "35c", 48)),
        0x70 => Some(("invoke-direct", "35c", 48)),
        0x71 => Some(("invoke-static", "35c", 48)),
        0x72 => Some(("invoke-interface", "35c", 48)),
        0x74 => Some(("invoke-virtual/range", "3rc", 48)),
        0x75 => Some(("invoke-super/range", "3rc", 48)),
        0x76 => Some(("invoke-direct/range", "3rc", 48)),
        0x77 => Some(("invoke-static/range", "3rc", 48)),
        0x78 => Some(("invoke-interface/range", "3rc", 48)),
        0x7b => Some(("neg-int", "12x", 16)),
        0x7c => Some(("not-int", "12x", 16)),
        0x7d => Some(("neg-long", "12x", 16)),
        0x7e => Some(("not-long", "12x", 16)),
        0x7f => Some(("neg-float", "12x", 16)),
        0x80 => Some(("neg-double", "12x", 16)),
        0x81 => Some(("int-to-long", "12x", 16)),
        0x82 => Some(("int-to-float", "12x", 16)),
        0x83 => Some(("int-to-double", "12x", 16)),
        0x84 => Some(("long-to-int", "12x", 16)),
        0x85 => Some(("long-to-float", "12x", 16)),
        0x86 => Some(("long-to-double", "12x", 16)),
        0x87 => Some(("float-to-int", "12x", 16)),
        0x88 => Some(("float-to-long", "12x", 16)),
        0x89 => Some(("float-to-double", "12x", 16)),
        0x8a => Some(("double-to-int", "12x", 16)),
        0x8b => Some(("double-to-long", "12x", 16)),
        0x8c => Some(("double-to-float", "12x", 16)),
        0x8d => Some(("int-to-byte", "12x", 16)),
        0x8e => Some(("int-to-char", "12x", 16)),
        0x8f => Some(("int-to-short", "12x", 16)),
        0x90 => Some(("add-int", "23x", 32)),
        0x91 => Some(("sub-int", "23x", 32)),
        0x92 => Some(("mul-int", "23x", 32)),
        0x93 => Some(("div-int", "23x", 32)),
        0x94 => Some(("rem-int", "23x", 32)),
        0x95 => Some(("and-int", "23x", 32)),
        0x96 => Some(("or-int", "23x", 32)),
        0x97 => Some(("xor-int", "23x", 32)),
        0x98 => Some(("shl-int", "23x", 32)),
        0x99 => Some(("shr-int", "23x", 32)),
        0x9a => Some(("ushr-int", "23x", 32)),
        0x9b => Some(("add-long", "23x", 32)),
        0x9c => Some(("sub-long", "23x", 32)),
        0x9d => Some(("mul-long", "23x", 32)),
        0x9e => Some(("div-long", "23x", 32)),
        0x9f => Some(("rem-long", "23x", 32)),
        0xa0 => Some(("and-long", "23x", 32)),
        0xa1 => Some(("or-long", "23x", 32)),
        0xa2 => Some(("xor-long", "23x", 32)),
        0xa3 => Some(("shl-long", "23x", 32)),
        0xa4 => Some(("shr-long", "23x", 32)),
        0xa5 => Some(("ushr-long", "23x", 32)),
        0xa6 => Some(("add-float", "23x", 32)),
        0xa7 => Some(("sub-float", "23x", 32)),
        0xa8 => Some(("mul-float", "23x", 32)),
        0xa9 => Some(("div-float", "23x", 32)),
        0xaa => Some(("rem-float", "23x", 32)),
        0xab => Some(("add-double", "23x", 32)),
        0xac => Some(("sub-double", "23x", 32)),
        0xad => Some(("mul-double", "23x", 32)),
        0xae => Some(("div-double", "23x", 32)),
        0xaf => Some(("rem-double", "23x", 32)),
        0xb0 => Some(("add-int/2addr", "12x", 16)),
        0xb1 => Some(("sub-int/2addr", "12x", 16)),
        0xb2 => Some(("mul-int/2addr", "12x", 16)),
        0xb3 => Some(("div-int/2addr", "12x", 16)),
        0xb4 => Some(("rem-int/2addr", "12x", 16)),
        0xb5 => Some(("and-int/2addr", "12x", 16)),
        0xb6 => Some(("or-int/2addr", "12x", 16)),
        0xb7 => Some(("xor-int/2addr", "12x", 16)),
        0xb8 => Some(("shl-int/2addr", "12x", 16)),
        0xb9 => Some(("shr-int/2addr", "12x", 16)),
        0xba => Some(("ushr-int/2addr", "12x", 16)),
        0xbb => Some(("add-long/2addr", "12x", 16)),
        0xbc => Some(("sub-long/2addr", "12x", 16)),
        0xbd => Some(("mul-long/2addr", "12x", 16)),
        0xbe => Some(("div-long/2addr", "12x", 16)),
        0xbf => Some(("rem-long/2addr", "12x", 16)),
        0xc0 => Some(("and-long/2addr", "12x", 16)),
        0xc1 => Some(("or-long/2addr", "12x", 16)),
        0xc2 => Some(("xor-long/2addr", "12x", 16)),
        0xc3 => Some(("shl-long/2addr", "12x", 16)),
        0xc4 => Some(("shr-long/2addr", "12x", 16)),
        0xc5 => Some(("ushr-long/2addr", "12x", 16)),
        0xc6 => Some(("add-float/2addr", "12x", 16)),
        0xc7 => Some(("sub-float/2addr", "12x", 16)),
        0xc8 => Some(("mul-float/2addr", "12x", 16)),
        0xc9 => Some(("div-float/2addr", "12x", 16)),
        0xca => Some(("rem-float/2addr", "12x", 16)),
        0xcb => Some(("add-double/2addr", "12x", 16)),
        0xcc => Some(("sub-double/2addr", "12x", 16)),
        0xcd => Some(("mul-double/2addr", "12x", 16)),
        0xce => Some(("div-double/2addr", "12x", 16)),
        0xcf => Some(("rem-double/2addr", "12x", 16)),
        0xd0 => Some(("add-int/lit16", "22s", 32)),
        0xd1 => Some(("rsub-int/lit16", "22s", 32)),
        0xd2 => Some(("mul-int/lit16", "22s", 32)),
        0xd3 => Some(("div-int/lit16", "22s", 32)),
        0xd4 => Some(("rem-int/lit16", "22s", 32)),
        0xd5 => Some(("and-int/lit16", "22s", 32)),
        0xd6 => Some(("or-int/lit16", "22s", 32)),
        0xd7 => Some(("xor-int/lit16", "22s", 32)),
        0xd8 => Some(("add-int/lit8", "22b", 32)),
        0xd9 => Some(("rsub-int/lit8", "22b", 32)),
        0xda => Some(("mul-int/lit8", "22b", 32)),
        0xdb => Some(("div-int/lit8", "22b", 32)),
        0xdc => Some(("rem-int/lit8", "22b", 32)),
        0xdd => Some(("and-int/lit8", "22b", 32)),
        0xde => Some(("or-int/lit8", "22b", 32)),
        0xdf => Some(("xor-int/lit8", "22b", 32)),
        0xe0 => Some(("shl-int/lit8", "22b", 32)),
        0xe1 => Some(("shr-int/lit8", "22b", 32)),
        0xe2 => Some(("ushr-int/lit8", "22b", 32)),
        0xfa => Some(("invoke-polymorphic", "45cc", 64)),
        0xfb => Some(("invoke-polymorphic/range", "4rcc", 64)),
        0xfc => Some(("invoke-custom", "35c", 48)),
        0xfd => Some(("invoke-custom/range", "3rc", 48)),
        0xfe => Some(("const-method-handle", "21c", 32)),
        0xff => Some(("const-method-type", "21c", 32)),
        _ => None,
    }
}
