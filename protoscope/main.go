//go:build !js

package main

import (
	"fmt"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/encoding/prototext"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/descriptorpb"
)

func textProtoFromFDS(fdsBytes []byte) (string, error) {
	fileProto := &descriptorpb.FileDescriptorSet{}
	if err := proto.Unmarshal(fdsBytes, fileProto); err != nil {
		return "", fmt.Errorf("Error unmarshalling proto message descriptor: %v", err)
	}

	out, err := prototext.MarshalOptions{
		Multiline: true,
		Indent:    "  ",
	}.Marshal(fileProto)
	if err != nil {
		return "", fmt.Errorf("Error marshalling to textproto: %v", err)
	}

	return string(out), nil
}

func jsonFromFDS(fdsBytes []byte) (string, error) {
	fileProto := &descriptorpb.FileDescriptorSet{}
	if err := proto.Unmarshal(fdsBytes, fileProto); err != nil {
		return "", fmt.Errorf("Error unmarshalling proto message descriptor: %v", err)
	}

	out, err := protojson.MarshalOptions{
		Multiline: true,
		Indent:    "  ",
	}.Marshal(fileProto)
	if err != nil {
		return "", fmt.Errorf("Error marshalling to JSON: %v", err)
	}

	return string(out), nil
}
