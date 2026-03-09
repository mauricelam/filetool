# Binwalk File Handler

This handler integrates [Binwalk v3](https://github.com/ReFirmLabs/binwalk) (Rust version) into the file tool using WebAssembly.

## Architecture

- `binwalk-rs/`: Git submodule pointing to the official Binwalk repository.
- `binwalk-wasm/`: Rust wrapper crate that exposes Binwalk's scanning engine via `wasm-bindgen`.
- `main.tsx`: React frontend that loads the WASM module and displays scan results.
- `binwalk-wasm-compatibility.patch`: Patch file containing necessary changes to `binwalk-rs` for WASM compatibility (disabling C-linked dependencies, gating OS-specific calls).

## Development and Building

To build the WASM module and the frontend:

1. Ensure `wasm-pack` is installed.
2. Apply the compatibility patch to the submodule:
   ```bash
   cd binwalk-rs
   patch -p1 < ../binwalk-wasm-compatibility.patch
   ```
3. Build from the workspace root:
   ```bash
   npm run build -w binwalk
   ```

## Testing

Integration tests are located in `tests/integration/binwalk.spec.ts`. Run them with:
```bash
npx playwright test tests/integration/binwalk.spec.ts
```
