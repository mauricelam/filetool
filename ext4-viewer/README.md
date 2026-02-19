# ext4 Viewer

A handler for inspecting and extracting files from ext4 disk images (.img files).

## Architecture

This handler is composed of two main parts:

1.  **WASM Backend (`ext4-wasm`)**: A Rust module that uses the `ext4-view` crate to parse ext4 filesystems. It provides functions to walk the directory tree and extract file contents. It uses `wasm-bindgen`, `serde`, and `tsify` to interface with the TypeScript frontend.
2.  **Frontend (`main.tsx`)**: A React component that utilizes the shared `ColumnView` component to display the hierarchical file listing. It shows file metadata and allows users to either download extracted files or open them with other handlers within FileMagic.

## Features

-   **Directory Browsing**: Navigate through the ext4 filesystem using a column-based view.
-   **File Metadata**: View details such as size, mode (permissions), and UID/GID for each file.
-   **Extraction**:
    -   **Open**: Extract a file and immediately open it in a compatible handler.
    -   **Download**: Extract and download a file to your local machine.

## Technical Details

-   **Filesystem Support**: Read-only access to ext2/ext4 filesystems.
-   **Integration**: Registered in `file-type-detector` to handle `.img` files.
-   **Build**: Built using `npm run build -w ext4-viewer`, which compiles the Rust code using `wasm-pack` and bundles the frontend with `esbuild`.
