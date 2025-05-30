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
             return "Error: Invalid number of arguments. Expected 1 (protobuf bytes) or 3 (protobuf bytes, FileDescriptorSet bytes, message name string)."
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

	// Process optional schema (args[1] FDS bytes, args[2] message name)
	if len(args) == 3 {
		fdsBytesJS := args[1]
		messageNameJS := args[2]

		// Check if schema arguments are explicitly null/undefined, meaning no schema processing.
		// The JS side should send null for fdsBytes and messageName if no schema is intended.
		if fdsBytesJS.IsNull() || fdsBytesJS.IsUndefined() {
			// No schema provided, proceed with default options
			disassembled := protoscope.Write(inputGoBytes, opts)
			return disassembled
		}

		if fdsBytesJS.Type() != js.TypeObject || !fdsBytesJS.Truthy() || fdsBytesJS.Get("byteLength").IsUndefined() {
			return "Error: Second argument (FileDescriptorSet bytes) must be a Uint8Array."
		}
		if messageNameJS.Type() != js.TypeString {
			return "Error: Third argument (message name) must be a string."
		}

		fdsLength := fdsBytesJS.Get("byteLength").Int()
		fdsGoBytes := make([]byte, fdsLength)
		js.CopyBytesToGo(fdsGoBytes, fdsBytesJS)

		goMessageName := messageNameJS.String()

		if fdsLength == 0 {
			return "Error: FileDescriptorSet bytes are empty."
		}
		if goMessageName == "" {
			return "Error: Message name is empty."
		}

		// Parse FileDescriptorSet bytes
		fdsProto := &descriptorpb.FileDescriptorSet{}
		if err := proto.Unmarshal(fdsGoBytes, fdsProto); err != nil {
			return fmt.Sprintf("Error unmarshalling FileDescriptorSet: %v", err)
		}

		files, err := protodesc.NewFiles(fdsProto)
		if err != nil {
			return fmt.Sprintf("Error processing FileDescriptorSet into files: %v", err)
		}

		// Find the message descriptor by its fully qualified name
		desc, err := files.FindDescriptorByName(protoreflect.FullName(goMessageName))
		if err != nil {
			// Error here usually means not found or ambiguity, but FindDescriptorByName is specific.
			// return fmt.Sprintf("Error finding message '%s' in schema: %v. Known messages: %s", goMessageName, err, listMessageNames(files))
			return fmt.Sprintf("Error finding message '%s' in schema: %v.", goMessageName, err)
		}

		md, ok := desc.(protoreflect.MessageDescriptor)
		if !ok || md == nil {
			return fmt.Sprintf("Error: Descriptor found for '%s' is not a message descriptor. Type: %T", goMessageName, desc)
		}

		opts.Schema = md
		opts.PrintFieldNames = true
		opts.PrintEnumNames = true
	}

	disassembled := protoscope.Write(inputGoBytes, opts)
	return disassembled
}

/*
// Helper function to list available message names for better error reporting (optional)
func listMessageNames(files protoreflect.Files) string {
	var names []string
	for i := 0; i < files.NumFiles(); i++ {
		fileDesc := files.Get(i)
		for j := 0; j < fileDesc.Messages().Len(); j++ {
			names = append(names, string(fileDesc.Messages().Get(j).FullName()))
		}
	}
	if len(names) == 0 {
		return "No messages found in FileDescriptorSet."
	}
	// Return first few names to avoid huge error messages
	const maxNames = 5
	if len(names) > maxNames {
		names = append(names[:maxNames], "...")
	}
	return fmt.Sprintf("Available messages: %v", names)
}
*/

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("protoscope", js.ValueOf(map[string]interface{}{
		"protoscopeFile": js.FuncOf(protoscopeFile),
	}))
	<-c
}
