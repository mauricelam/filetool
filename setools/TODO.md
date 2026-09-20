# TODO: Restore SETools Functionality

The transition from a git submodule to the `@mauricelam/selinux-wasm` npm package has been completed in this codebase, but the current package version (`0.0.310`) is missing the required custom API exports.

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

Without these `api_*` bridge exports in `@mauricelam/selinux-wasm`, calling `mod.ccall('api_load_policy', ...)` throws an error because the symbol is missing from the compiled WASM binary.

## Remaining Tasks

- [ ] **Update `@mauricelam/selinux-wasm` npm package**:
    - The package build must integrate the C logic from `setools/policy_api.c`.
    - It must export all functions starting with `api_` (`api_load_policy`, `api_free_policy`, `api_get_version`, `api_get_symbol_count`, `api_get_symbol_name`, `api_get_rule_count`, `api_get_rules`, `api_is_type_attribute`, `api_get_boolean_state`, `api_get_permissions`, `api_free_string`).
    - Standard Emscripten methods (`ccall`, `cwrap`, `HEAPU32`, `HEAPU8`, `UTF8ToString`) must be exported.
- [ ] **Verify Worker Integration**:
    - Once the updated package version is published, update the version in `setools/package.json`.
    - Run `npx playwright test setools/tests/setools.spec.ts` to confirm full policy loading, filtering, and search functionality.
- [ ] **Cleanup**:
    - Remove `setools/SELINUX_WASM_CHANGES.md` once the package update task is completed.
