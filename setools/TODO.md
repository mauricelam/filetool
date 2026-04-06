# TODO: Restore SETools Functionality

The transition from a git submodule to the `@mauricelam/selinux-wasm` npm package has been started, but the current package version (`0.0.310`) is missing the required custom API exports.

## Remaining Tasks

- [ ] **Update `@mauricelam/selinux-wasm` npm package**:
    - The package needs to be updated to include the logic from `setools/policy_api.c`.
    - It must export all functions starting with `api_` (e.g., `api_load_policy`, `api_get_rules`, etc.).
- [ ] **Verify Worker Integration**:
    - Once the updated package is available, update the dependency version in `setools/package.json`.
    - Run the built-in tests (`npx playwright test setools/tests/setools.spec.ts`) to ensure the viewer can load and parse policies correctly.
- [ ] **Cleanup**:
    - Remove `setools/policy_api.c` once the functionality is fully integrated into the npm package.
    - Remove `setools/SELINUX_WASM_CHANGES.md` once the task is complete.
