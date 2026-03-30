package main

import (
	"encoding/pem"
	"fmt"
	"strings"
	"syscall/js"

	"github.com/google/der-ascii/der2ascii"
)

func main() {
	js.Global().Set("derToAscii", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		if len(args) != 1 {
			return js.ValueOf("Error: Expected 1 argument")
		}

		// Get the ArrayBuffer from JavaScript
		arrayBuffer := args[0]
		if arrayBuffer.Type() != js.TypeObject {
			return js.ValueOf("Error: Expected ArrayBuffer")
		}

		// Get the length of the ArrayBuffer
		length := arrayBuffer.Get("byteLength").Int()

		// Create a Go byte slice to hold the data
		data := make([]byte, length)

		// Copy the data from JavaScript to Go
		js.CopyBytesToGo(data, arrayBuffer)

		// Try to decode as PEM
		var outputs []string
		rest := data
		for {
			var block *pem.Block
			block, rest = pem.Decode(rest)
			if block == nil {
				break
			}
			outputs = append(outputs, fmt.Sprintf("# %s\n%s", block.Type, der2ascii.DerToASCII(block.Bytes)))
		}

		if len(outputs) > 0 {
			return js.ValueOf(strings.Join(outputs, "\n"))
		}

		// Fall back to raw DER
		result := der2ascii.DerToASCII(data)
		return js.ValueOf(result)
	}))

	// Keep the program running
	select {}
}
