package main

import (
	"reflect"
	"testing"
)

func TestParseProguardMapping(t *testing.T) {
	content := `
# This is a comment
com.example.MyClass -> a.b.c:
    int myField -> a
    void myMethod() -> a
com.example.AnotherClass -> a.b.d:
`
	expected := map[string]string{
		"a.b.c": "com.example.MyClass",
		"a.b.d": "com.example.AnotherClass",
	}

	actual := parseProguardMapping(content)

	if !reflect.DeepEqual(expected, actual) {
		t.Errorf("Expected %v, but got %v", expected, actual)
	}
}
