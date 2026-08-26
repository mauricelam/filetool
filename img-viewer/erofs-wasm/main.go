//go:build js && wasm

package main

import (
	"bytes"
	"fmt"
	"io/fs"
	"path"
	"syscall/js"

	"github.com/erofs/go-erofs"
)

var (
	currentData  []byte
	currentEroFS fs.FS
)

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("erofs", js.ValueOf(map[string]interface{}{
		"setFileData": js.FuncOf(setFileData),
		"parseErofs":  js.FuncOf(parseErofs),
		"readFile":    js.FuncOf(readFile),
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
	fsys, err := erofs.Open(reader)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": fmt.Sprintf("Failed to open erofs: %v", err)})
	}
	currentEroFS = fsys

	return nil
}

func parseErofs(this js.Value, args []js.Value) interface{} {
	if currentEroFS == nil {
		return js.ValueOf(map[string]interface{}{"error": "No erofs file loaded"})
	}

	tree, err := walkDir(currentEroFS, ".")
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": fmt.Sprintf("Failed to walk erofs: %v", err)})
	}

	return tree
}

func walkDir(fsys fs.FS, currentPath string) (interface{}, error) {
	entries, err := fs.ReadDir(fsys, currentPath)
	if err != nil {
		return nil, err
	}

	children := make(map[string]interface{})
	for _, entry := range entries {
		name := entry.Name()
		var fullPath string
		if currentPath == "." {
			fullPath = "/" + name
		} else {
			fullPath = path.Join(currentPath, name)
			if !bytes.HasPrefix([]byte(fullPath), []byte("/")) {
				fullPath = "/" + fullPath
			}
		}

		if entry.IsDir() {
			relPath := name
			if currentPath != "." {
				relPath = path.Join(currentPath, name)
			}
			childTree, err := walkDir(fsys, relPath)
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
	if currentEroFS == nil {
		return js.ValueOf(map[string]interface{}{"error": "No erofs file loaded"})
	}

	filePath := args[0].String()
	// Strip leading slash if present for fs.ReadFile
	cleanPath := filePath
	if len(cleanPath) > 0 && cleanPath[0] == '/' {
		cleanPath = cleanPath[1:]
	}

	content, err := fs.ReadFile(currentEroFS, cleanPath)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": fmt.Sprintf("Failed to read file: %v", err)})
	}

	uint8Array := js.Global().Get("Uint8Array").New(len(content))
	js.CopyBytesToJS(uint8Array, content)
	return uint8Array
}
