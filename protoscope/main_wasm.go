//go:build js && wasm

package main

import (
	"syscall/js"
)

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("protoscope", js.ValueOf(map[string]interface{}{
		"protoscopeFile": js.FuncOf(protoscopeFile),
		"exportTextProto": js.FuncOf(exportTextProto),
		"exportJSON":      js.FuncOf(exportJSON),
	}))
	<-c
}
