package main

import (
	"strings"
	"testing"

	"github.com/jhump/protoreflect/desc/protoparse"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/descriptorpb"
)

func TestTextProtoFromFDS(t *testing.T) {
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

	out, err := textProtoFromFDS(fdsBytes)
	if err != nil {
		t.Fatalf("textProtoFromFDS failed: %v", err)
	}

	expected := `file: {
  name:  "test.proto"
  message_type:  {
    name:  "Test"
  }
  syntax:  "proto3"
}
`
	if strings.ReplaceAll(out, " ", "") != strings.ReplaceAll(expected, " ", "") {
		t.Errorf("Expected output %q, but got %q", expected, out)
	}
}

func TestJsonFromFDS(t *testing.T) {
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

	out, err := jsonFromFDS(fdsBytes)
	if err != nil {
		t.Fatalf("jsonFromFDS failed: %v", err)
	}

	expected := `{
  "file": [
    {
      "name": "test.proto",
      "messageType": [
        {
          "name": "Test"
        }
      ],
      "syntax": "proto3"
    }
  ]
}`
	if strings.ReplaceAll(out, " ", "") != strings.ReplaceAll(expected, " ", "") {
		t.Errorf("Expected output %q, but got %q", expected, out)
	}
}
