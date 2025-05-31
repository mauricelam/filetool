package main

import (
	"fmt"
	"syscall/js"

	"github.com/protocolbuffers/protoscope"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
)

func protoscopeFile(this js.Value, args []js.Value) interface{} {
	if len(args) != 1 && len(args) != 3 {
		if len(args) == 2 { // Common mistake from JS might be to pass 2 args if schema is null
			return "Error: Invalid number of arguments. Expected 1 (protobuf bytes) or 3 (protobuf bytes, message descriptor bytes, message name string)."
		}
		return "Error: Invalid number of arguments. Expected 1 or 3."
	}

	// Process main protobuf bytes (args[0])
	inputBytesJS := args[0]
	if inputBytesJS.Type() != js.TypeObject || !inputBytesJS.Truthy() || inputBytesJS.Get("byteLength").IsUndefined() {
		return "Error: First argument (protobuf bytes) must be a Uint8Array."
	}
	inputLength := inputBytesJS.Get("byteLength").Int()
	inputGoBytes := make([]byte, inputLength)
	js.CopyBytesToGo(inputGoBytes, inputBytesJS)

	opts := protoscope.WriterOptions{
		ExplicitWireTypes:      true,
		ExplicitLengthPrefixes: true,
	}

	// Process optional schema (args[1] message descriptor bytes, args[2] message name)
	if len(args) == 3 {
		descBytesJS := args[1]
		messageNameJS := args[2]

		// Check if schema arguments are explicitly null/undefined, meaning no schema processing.
		// The JS side should send null for descBytes and messageName if no schema is intended.
		if descBytesJS.IsNull() || descBytesJS.IsUndefined() {
			// No schema provided, proceed with default options
			disassembled := protoscope.Write(inputGoBytes, opts)
			return disassembled
		}

		if descBytesJS.Type() != js.TypeObject || !descBytesJS.Truthy() || descBytesJS.Get("byteLength").IsUndefined() {
			return "Error: Second argument (message descriptor bytes) must be a Uint8Array."
		}
		if messageNameJS.Type() != js.TypeString {
			return "Error: Third argument (message name) must be a string."
		}

		descLength := descBytesJS.Get("byteLength").Int()
		descGoBytes := make([]byte, descLength)
		js.CopyBytesToGo(descGoBytes, descBytesJS)

		goMessageName := messageNameJS.String()
		// Remove leading "." if present
		if len(goMessageName) > 0 && goMessageName[0] == '.' {
			goMessageName = goMessageName[1:]
		}

		if descLength == 0 {
			return "Error: Message descriptor bytes are empty."
		}
		if goMessageName == "" {
			return "Error: Message name is empty."
		}

		// Parse the message descriptor
		fileProto := &descriptorpb.FileDescriptorSet{}
		if err := proto.Unmarshal(descGoBytes, fileProto); err != nil {
			return fmt.Sprintf("Error unmarshalling proto message descriptor: %v", err)
		}

		// Create a file descriptor
		files, err := protodesc.NewFiles(fileProto)
		if err != nil {
			return fmt.Sprintf("Error creating file descriptor: %v", err)
		}

		// Get the message descriptor directly
		desc, err := files.FindDescriptorByName(protoreflect.FullName(goMessageName))
		if err != nil {
			return fmt.Sprintf("Error finding message '%s' (%s) in schema: %v", goMessageName, protoreflect.FullName(goMessageName), err)
		}

		md, ok := desc.(protoreflect.MessageDescriptor)
		if !ok {
			return fmt.Sprintf("Error: Descriptor for '%s' is not a message descriptor", goMessageName)
		}

		opts.Schema = md
		opts.PrintFieldNames = true
		opts.PrintEnumNames = true
	}

	disassembled := protoscope.Write(inputGoBytes, opts)
	return disassembled
}

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("protoscope", js.ValueOf(map[string]interface{}{
		"protoscopeFile": js.FuncOf(protoscopeFile),
	}))
	<-c
}
