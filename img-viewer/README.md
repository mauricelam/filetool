# img Viewer

A handler for inspecting and extracting files from ext4 and EROFS disk images (.img files).

## Architecture

This handler is composed of two WASM backends and a React frontend:

1.  **ext4 WASM Backend (`ext4-wasm`)**: A Rust module that uses the `ext4-view` crate to parse ext4 filesystems.
2.  **EROFS WASM Backend (`erofs-wasm`)**: A Go WebAssembly module that uses `github.com/erofs/go-erofs` to parse EROFS filesystems.
3.  **Frontend (`main.tsx`)**: A React component that inspects image magic numbers (ext4 `0xEF53` at offset 1080 or EROFS `0xE0F5E1E2` at offset 0x400), dynamically loads the appropriate WASM backend, and utilizes the shared `ColumnView` component to display the hierarchical file listing.

## Features

-   **Directory Browsing**: Navigate through ext4 and EROFS filesystems using a column-based view.
-   **File Metadata**: View details such as size, mode (permissions), and UID/GID for each file.
-   **Extraction**:
    -   **Open**: Extract a file and immediately open it in a compatible handler.
    -   **Download**: Extract and download a file to your local machine.

## Technical Details

-   **Filesystem Support**: Read-only access to ext2/ext4 and EROFS filesystems.
-   **Integration**: Registered in `file-type-detector` to handle `.img` files.
-   **Build**: Built using `npx turbo build --filter=@filetool/img-viewer`, which compiles the Rust module with `wasm-pack` and the Go module with `go build` for `GOOS=js GOARCH=wasm`.
