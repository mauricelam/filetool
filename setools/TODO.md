# SETools Functionality Status

The transition from a git submodule to the `@mauricelam/selinux-wasm` package (`github:mauricelam/selinux#main`) is completed. The `main` branch of `mauricelam/selinux` now integrates `policy_api.c` and exports all required `api_*` bridge functions natively in its WASM build.

## Why Custom `api_*` Bridge Exports Are Needed

Although `libsepol/wasm_example` in the upstream `selinux` repository runs without any problems, it only performs basic security context checking (`sepol_check_context`).

In contrast, the SETools viewer in `filetool` provides full binary SELinux policy (`sepolicy`) analysis and search capabilities. It requires inspecting complex internal C data structures of `libsepol` that are not exposed by the default WASM build:

1. **Binary Policy Loading & Versioning:**
   - Standard `wasm_example` does not load or parse binary policy databases (`policydb_t`).
   - SETools needs `api_load_policy` and `api_get_version` to parse compiled policy images into `policydb` structures and retrieve the policy version (e.g., version 30 for Android policies).

2. **Symbol Table Extraction:**
   - SETools lists and categorizes thousands of policy symbols (classes, roles, types, type attributes, users, and booleans).
   - `api_get_symbol_count`, `api_get_symbol_name`, `api_is_type_attribute`, and `api_get_boolean_state` enable direct, high-performance traversal of internal symbol tables (`symtab`).

3. **Access Vector Table (`avtab`) Rule Search & Resolution:**
   - SETools searches and filters tens of thousands of rules (`allow`, `auditallow`, `dontaudit`, `neverallow`) using plain-text and POSIX regex matching.
   - Doing this in JavaScript by reading WASM memory layout directly would be prohibitively slow and fragile.
   - `api_get_rule_count` and `api_get_rules` run the traversal and filtering logic natively in C inside the WASM module.
   - `api_get_permissions` uses `sepol_av_to_string` to resolve numeric access vector bitmasks to human-readable permission lists (e.g., `{ find read write }`).

All required `api_*` bridge functions are now integrated directly into the `main` branch of `https://github.com/mauricelam/selinux`.

## Status

- [x] **Update `@mauricelam/selinux-wasm` dependency**:
    - `setools/package.json` uses `"@mauricelam/selinux-wasm": "github:mauricelam/selinux#main"`.
    - All `api_*` bridge functions and Emscripten runtime methods (`ccall`, `cwrap`, `HEAPU32`, `HEAPU8`, `UTF8ToString`) are exported by `Makefile.wasm`.
