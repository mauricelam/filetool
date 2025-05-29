package main

import (
	"syscall/js"

	"github.com/protocolbuffers/protoscope"
)

func protoscopeFile(this js.Value, args []js.Value) interface{} {
	if len(args) != 1 {
		return "Error: Invalid number of arguments. Expected 1 (byte slice)."
	}

	inputBytes := args[0]
	if inputBytes.Type() != js.TypeObject || !inputBytes.Truthy() || inputBytes.Get("byteLength").IsUndefined() {
		return "Error: Argument must be a byte slice (Uint8Array)."
	}

	// Convert JavaScript Uint8Array to Go byte slice
	length := inputBytes.Get("byteLength").Int()
	goBytes := make([]byte, length)
	js.CopyBytesToGo(goBytes, inputBytes)

	// Disassemble the protobuf bytes into Protoscope text format.
	// The Write function here means "write as Protoscope text".
	disassembled := protoscope.Write(goBytes, protoscope.WriterOptions{
		ExplicitWireTypes:      true,
		ExplicitLengthPrefixes: true,
	})
	// The Write function does not return an error.
	// It might panic for severely malformed inputs, but we'll rely on
	// JavaScript to catch that if it propagates as an exception.
	return disassembled
}

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("protoscope", js.ValueOf(map[string]interface{}{
		"protoscopeFile": js.FuncOf(protoscopeFile),
	}))
	<-c
}
