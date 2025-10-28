package main

import (
	"fmt"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/encoding/prototext"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

// convertPBToDynamicMessage takes raw protobuf bytes, a schema, and a message name,
// and returns a dynamic protobuf message.
func convertPBToDynamicMessage(pbBytes []byte, fdsBytes []byte, messageName string) (protoreflect.ProtoMessage, error) {
	fileProto := &descriptorpb.FileDescriptorSet{}
	if err := proto.Unmarshal(fdsBytes, fileProto); err != nil {
		return nil, fmt.Errorf("failed to unmarshal FileDescriptorSet: %v", err)
	}

	files, err := protodesc.NewFiles(fileProto)
	if err != nil {
		return nil, fmt.Errorf("failed to create protoreflect.Files from FileDescriptorSet: %v", err)
	}

	// Message names in descriptors are fully qualified. Remove leading dot if present.
	if len(messageName) > 0 && messageName[0] == '.' {
		messageName = messageName[1:]
	}

	desc, err := files.FindDescriptorByName(protoreflect.FullName(messageName))
	if err != nil {
		return nil, fmt.Errorf("failed to find message '%s' in schema: %v", messageName, err)
	}

	msgDesc, ok := desc.(protoreflect.MessageDescriptor)
	if !ok {
		return nil, fmt.Errorf("descriptor for '%s' is not a message descriptor", messageName)
	}

	// Create a new dynamic message based on the descriptor and unmarshal the binary data into it.
	dynMsg := dynamicpb.NewMessage(msgDesc)
	if err := proto.Unmarshal(pbBytes, dynMsg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal protobuf binary into dynamic message: %v", err)
	}

	return dynMsg, nil
}

// textProtoFromPB converts a binary protobuf message to its textproto representation using a schema.
func textProtoFromPB(pbBytes []byte, fdsBytes []byte, messageName string) (string, error) {
	dynMsg, err := convertPBToDynamicMessage(pbBytes, fdsBytes, messageName)
	if err != nil {
		return "", err
	}

	out, err := prototext.MarshalOptions{
		Multiline: true,
		Indent:    "  ",
	}.Marshal(dynMsg)
	if err != nil {
		return "", fmt.Errorf("failed to marshal dynamic message to textproto: %v", err)
	}

	return string(out), nil
}

// jsonFromPB converts a binary protobuf message to its JSON representation using a schema.
func jsonFromPB(pbBytes []byte, fdsBytes []byte, messageName string) (string, error) {
	dynMsg, err := convertPBToDynamicMessage(pbBytes, fdsBytes, messageName)
	if err != nil {
		return "", err
	}

	out, err := protojson.MarshalOptions{
		Multiline:     true,
		Indent:        "  ",
		UseProtoNames: true, // Use field names from .proto file
	}.Marshal(dynMsg)
	if err != nil {
		return "", fmt.Errorf("failed to marshal dynamic message to JSON: %v", err)
	}

	return string(out), nil
}
