//go:build js && wasm

package main

import (
	"bytes"
	"fmt"
	"io"
	"io/fs"
	"path"
	"syscall/js"

	"github.com/KarpelesLab/squashfs"
	"github.com/klauspost/compress/zstd"
	"github.com/ulikunitz/xz"
)

var (
	currentData []byte
	currentSqfs *squashfs.Superblock
)

func init() {
	// Register ZSTD support
	squashfs.RegisterDecompressor(squashfs.ZSTD, squashfs.MakeDecompressor(zstd.ZipDecompressor()))

	// Register XZ support
	squashfs.RegisterDecompressor(squashfs.XZ, squashfs.MakeDecompressorErr(func(r io.Reader) (io.ReadCloser, error) {
		rc, err := xz.NewReader(r)
		if err != nil {
			return nil, err
		}
		return io.NopCloser(rc), nil
	}))
}

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("squashfs", js.ValueOf(map[string]interface{}{
		"setFileData":   js.FuncOf(setFileData),
		"parseSquashfs": js.FuncOf(parseSquashfs),
		"readFile":      js.FuncOf(readFile),
	}))
	<-c
}

func setFileData(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return js.ValueOf(map[string]interface{}{"error": "Missing data argument"})
	}

	data := make([]byte, args[0].Length())
	js.CopyBytesToGo(data, args[0])
	currentData = data

	reader := bytes.NewReader(currentData)
	sqfs, err := squashfs.New(reader)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": fmt.Sprintf("Failed to open squashfs: %v", err)})
	}
	currentSqfs = sqfs

	return nil
}

func parseSquashfs(this js.Value, args []js.Value) interface{} {
	if currentSqfs == nil {
		return js.ValueOf(map[string]interface{}{"error": "No squashfs file loaded"})
	}

	tree, err := walkDir(currentSqfs, ".")
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": fmt.Sprintf("Failed to walk squashfs: %v", err)})
	}

	return tree
}

func walkDir(sqfs *squashfs.Superblock, currentPath string) (interface{}, error) {
	entries, err := sqfs.ReadDir(currentPath)
	if err != nil {
		return nil, err
	}

	children := make(map[string]interface{})
	for _, entry := range entries {
		name := entry.Name()
		fullPath := path.Join(currentPath, name)

		if entry.IsDir() {
			childTree, err := walkDir(sqfs, fullPath)
			if err != nil {
				return nil, err
			}
			children[name] = childTree
		} else {
			info, err := entry.Info()
			if err != nil {
				return nil, err
			}

			mode := uint32(info.Mode())
			size := uint64(info.Size())

			children[name] = map[string]interface{}{
				"_size": size,
				"_mode": mode,
				"_path": fullPath,
			}
		}
	}

	return children, nil
}

func readFile(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return js.ValueOf(map[string]interface{}{"error": "Missing path argument"})
	}
	if currentSqfs == nil {
		return js.ValueOf(map[string]interface{}{"error": "No squashfs file loaded"})
	}

	filePath := args[0].String()
	content, err := fs.ReadFile(currentSqfs, filePath)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": fmt.Sprintf("Failed to read file: %v", err)})
	}

	uint8Array := js.Global().Get("Uint8Array").New(len(content))
	js.CopyBytesToJS(uint8Array, content)
	return uint8Array
}
