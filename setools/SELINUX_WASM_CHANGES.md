# Changes Integrated into @mauricelam/selinux-wasm (main branch)

The required C bridge API (`policy_api.c`) and exported functions have been integrated directly into the `main` branch of `https://github.com/mauricelam/selinux`.

## Exported Bridge Functions
The Emscripten build in `libsepol/Makefile.wasm` exports:

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

Along with standard Emscripten runtime methods `ccall`, `cwrap`, `stringToUTF8`, `allocateUTF8`, `getValue`, `setValue`, `HEAPU8`, `HEAPU32`, and `UTF8ToString`.
