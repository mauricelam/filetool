package main

import (
	"testing"

	"github.com/jhump/protoreflect/desc/protoparse"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

func TestTextProtoFromPB(t *testing.T) {
	parser := protoparse.Parser{}
	fds, err := parser.ParseFiles("test.proto")
	if err != nil {
		t.Fatalf("Failed to parse test.proto: %v", err)
	}

	fdsBytes, err := proto.Marshal(&descriptorpb.FileDescriptorSet{
		File: []*descriptorpb.FileDescriptorProto{fds[0].AsFileDescriptorProto()},
	})
	if err != nil {
		t.Fatalf("Failed to marshal FileDescriptorSet: %v", err)
	}

	files, err := protodesc.NewFiles(&descriptorpb.FileDescriptorSet{
		File: []*descriptorpb.FileDescriptorProto{fds[0].AsFileDescriptorProto()},
	})
	if err != nil {
		t.Fatalf("Failed to create protoreflect.Files: %v", err)
	}

	desc, err := files.FindDescriptorByName("Test")
	if err != nil {
		t.Fatalf("Failed to find message Test in test.proto: %v", err)
	}

	msgDesc, ok := desc.(protoreflect.MessageDescriptor)
	if !ok {
		t.Fatalf("Descriptor for Test is not a message descriptor")
	}

	dynMsg := dynamicpb.NewMessage(msgDesc)
	dynMsg.Set(msgDesc.Fields().ByName("name"), protoreflect.ValueOfString("test"))
	dynMsg.Set(msgDesc.Fields().ByName("id"), protoreflect.ValueOfInt32(123))

	pbBytes, err := proto.Marshal(dynMsg)
	if err != nil {
		t.Fatalf("Failed to marshal dynamic message: %v", err)
	}

	out, err := textProtoFromPB(pbBytes, fdsBytes, "Test")
	if err != nil {
		t.Fatalf("textProtoFromPB failed: %v", err)
	}

	expected := `name: "test"
id: 123
`
	if out != expected {
		t.Errorf("Expected output %q, but got %q", expected, out)
	}
}

func TestJsonFromPB(t *testing.T) {
	parser := protoparse.Parser{}
	fds, err := parser.ParseFiles("test.proto")
	if err != nil {
		t.Fatalf("Failed to parse test.proto: %v", err)
	}

	fdsBytes, err := proto.Marshal(&descriptorpb.FileDescriptorSet{
		File: []*descriptorpb.FileDescriptorProto{fds[0].AsFileDescriptorProto()},
	})
	if err != nil {
		t.Fatalf("Failed to marshal FileDescriptorSet: %v", err)
	}

	files, err := protodesc.NewFiles(&descriptorpb.FileDescriptorSet{
		File: []*descriptorpb.FileDescriptorProto{fds[0].AsFileDescriptorProto()},
	})
	if err != nil {
		t.Fatalf("Failed to create protoreflect.Files: %v", err)
	}

	desc, err := files.FindDescriptorByName("Test")
	if err != nil {
		t.Fatalf("Failed to find message Test in test.proto: %v", err)
	}

	msgDesc, ok := desc.(protoreflect.MessageDescriptor)
	if !ok {
		t.Fatalf("Descriptor for Test is not a message descriptor")
	}

	dynMsg := dynamicpb.NewMessage(msgDesc)
	dynMsg.Set(msgDesc.Fields().ByName("name"), protoreflect.ValueOfString("test"))
	dynMsg.Set(msgDesc.Fields().ByName("id"), protoreflect.ValueOfInt32(123))

	pbBytes, err := proto.Marshal(dynMsg)
	if err != nil {
		t.Fatalf("Failed to marshal dynamic message: %v", err)
	}

	out, err := jsonFromPB(pbBytes, fdsBytes, "Test")
	if err != nil {
		t.Fatalf("jsonFromPB failed: %v", err)
	}

	expected := `{
  "name": "test",
  "id": 123
}`
	if out != expected {
		t.Errorf("Expected output %q, but got %q", expected, out)
	}
}
