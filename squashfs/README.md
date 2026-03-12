# SquashFS Viewer

A SquashFS image viewer using Go (WASM) and React.

## Example Image

The example image at `example/example.squashfs` was generated using the following command:

```bash
mkdir -p sample_root/dir1
echo "Hello SquashFS!" > sample_root/hello.txt
echo "This is a nested file." > sample_root/dir1/nested.txt
chmod +x sample_root/hello.txt
mksquashfs sample_root/ example.squashfs -comp xz
```

### Contents:
- `hello.txt`: A text file with executable bit set.
- `dir1/`: A directory.
- `dir1/nested.txt`: A text file inside `dir1`.
