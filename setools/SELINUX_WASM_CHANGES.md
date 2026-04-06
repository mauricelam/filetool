# Required Changes for @mauricelam/selinux-wasm

To support the SETools viewer in the `filetool` repository without using a git submodule, the `@mauricelam/selinux-wasm` npm package must be updated to include the custom bridge API.

## 1. Include `policy_api.c`
The logic in `setools/policy_api.c` (from the `filetool` repo) must be integrated into the `selinux-wasm` build process. This file provides a simplified interface for searching and inspecting binary policies using `libsepol` internal functions.

## 2. Update Exported Functions
The Emscripten build must export the following functions to make them available to the JavaScript worker:

- `_api_load_policy`
- `_api_free_policy`
- `_api_get_version`
- `_api_get_symbol_count`
- `_api_get_symbol_name`
- `_api_get_rule_count`
- `_api_get_rules`
- `_api_is_type_attribute`
- `_api_get_boolean_state`
- `_api_get_permissions`
- `_api_free_string`

Additionally, standard Emscripten runtime methods `ccall`, `cwrap`, `HEAPU32`, `HEAPU8`, and `UTF8ToString` must be exported.

## 3. Library Linkage
The build process in `selinux-wasm` must link against `libsepol.a` and include the appropriate headers from `libsepol/include`.

## 4. Current State
As of version `0.0.310`, the npm package only contains standard `libsepol` exports and is missing the `api_` bridge, which causes the SETools worker to fail at runtime when trying to call these missing functions.
