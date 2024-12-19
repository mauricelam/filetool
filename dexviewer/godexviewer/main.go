package main

import (
	"bytes"
	"fmt"
	"strings"
	"syscall/js"

	"github.com/csnewman/dextk"
)

type DexFile struct {
	bytes []byte
}

var dexFiles = make(map[int]DexFile)

func main() {
	// Create dextk object to store functions
	dextkObj := map[string]interface{}{
		"createDex":             js.FuncOf(createDex),
		"getClasses":            js.FuncOf(getClasses),
		"getMethodNames":        js.FuncOf(getMethodNames),
		"getMethodInstructions": js.FuncOf(getMethodInstructions),
	}

	// Export dextk object to JavaScript
	js.Global().Set("godexviewer", js.ValueOf(dextkObj))

	// Keep the Go program running
	<-make(chan bool)
}

func createDex(this js.Value, args []js.Value) any {
	// Get the Uint8Array from JavaScript
	array := args[0]

	// Create Go byte slice and copy data
	dexbytes := make([]byte, array.Length())
	js.CopyBytesToGo(dexbytes, array)

	// Generate next available key
	key := len(dexFiles)

	// Store in map
	dexFiles[key] = DexFile{
		bytes: dexbytes,
	}

	return key
}

func getClasses(this js.Value, args []js.Value) any {
	// Get the dex file ID from JavaScript
	dexId := args[0].Int()

	// Get the dex file from map
	dexFile, ok := dexFiles[dexId]
	if !ok {
		fmt.Println("Invalid dex file ID")
		return nil
	}

	r, err := dextk.Read(bytes.NewReader(dexFile.bytes))
	if err != nil {
		fmt.Println(err)
	}

	var classNames []string

	ci := r.ClassIter()
	for ci.HasNext() {
		node, err := ci.Next()
		if err != nil {
			fmt.Println(err)
			continue
		}

		classNames = append(classNames, node.Name.String())
	}

	fmt.Println("Done")
	return js.ValueOf(stringSliceToAnySlice(classNames))
}

func getMethodNames(this js.Value, args []js.Value) any {
	// Get the dex file ID from JavaScript
	dexId := args[0].Int()

	// Get the class name from JavaScript
	className := args[1].String()

	// Get the dex file from map
	dexFile, ok := dexFiles[dexId]
	if !ok {
		fmt.Println("Invalid dex file ID")
		return nil
	}

	r, err := dextk.Read(bytes.NewReader(dexFile.bytes))
	if err != nil {
		fmt.Println(err)
		return nil
	}

	var methodNames []string

	// Iterate through classes to find matching class
	ci := r.ClassIter()
	for ci.HasNext() {
		node, err := ci.Next()
		if err != nil {
			fmt.Println(err)
			continue
		}

		if node.Name.String() == className {
			// Add direct methods
			for _, method := range node.DirectMethods {
				signature := formatMethod(method)
				methodNames = append(methodNames, signature)
			}

			// Add virtual methods
			for _, method := range node.VirtualMethods {
				signature := formatMethod(method)
				methodNames = append(methodNames, signature)
			}
			break
		}
	}

	return js.ValueOf(stringSliceToAnySlice(methodNames))
}

func formatMethod(method dextk.MethodNode) string {
	shorty := method.Shorty.String()
	var returnType string
	switch shorty[0] {
	case 'V':
		returnType = "void"
	case 'Z':
		returnType = "boolean"
	case 'B':
		returnType = "byte"
	case 'S':
		returnType = "short"
	case 'C':
		returnType = "char"
	case 'I':
		returnType = "int"
	case 'J':
		returnType = "long"
	case 'F':
		returnType = "float"
	case 'D':
		returnType = "double"
	case 'L':
		returnType = method.ReturnType.String()
	case '[':
		returnType = method.ReturnType.String() + "[]"
	default:
		returnType = "unknown"
	}

	// Format parameter types
	var params []string
	for _, c := range shorty[1:] {
		var paramType string
		switch c {
		case 'Z':
			paramType = "boolean"
		case 'B':
			paramType = "byte"
		case 'S':
			paramType = "short"
		case 'C':
			paramType = "char"
		case 'I':
			paramType = "int"
		case 'J':
			paramType = "long"
		case 'F':
			paramType = "float"
		case 'D':
			paramType = "double"
		case 'L':
			paramType = "Object"
		case '[':
			paramType = "Array"
		default:
			paramType = "unknown"
		}
		params = append(params, paramType)
	}

	return fmt.Sprintf("%s %s(%s)", returnType, method.Name.String(), strings.Join(params, ", "))
}

func getMethodInstructions(this js.Value, args []js.Value) any {
	// Get the dex file ID from JavaScript
	dexId := args[0].Int()
	// Get the class name from JavaScript
	className := args[1].String()
	// Get the method name from JavaScript
	methodName := args[2].String()

	// Get the dex file from map
	dexFile, ok := dexFiles[dexId]
	if !ok {
		fmt.Println("Invalid dex file ID")
		return nil
	}

	r, err := dextk.Read(bytes.NewReader(dexFile.bytes))
	if err != nil {
		fmt.Println(err)
		return nil
	}

	// Find the method in the class
	ci := r.ClassIter()
	for ci.HasNext() {
		node, err := ci.Next()
		if err != nil {
			fmt.Println(err)
			continue
		}

		if node.Name.String() == className {
			// Check direct methods
			for _, method := range node.DirectMethods {
				if method.Name.String() == methodName {
					return js.ValueOf(stringSliceToAnySlice(getInstructions(r, method)))
				}
			}
			// Check virtual methods
			for _, method := range node.VirtualMethods {
				if method.Name.String() == methodName {
					return js.ValueOf(stringSliceToAnySlice(getInstructions(r, method)))
				}
			}
			break
		}
	}

	return nil
}

func stringSliceToAnySlice(input []string) []any {
	result := make([]any, len(input))
	for i, v := range input {
		result[i] = v
	}
	return result
}

func getInstructions(r *dextk.Reader, m dextk.MethodNode) []string {
	if m.CodeOff == 0 {
		return nil
	}

	c, err := r.ReadCodeAndParse(m.CodeOff)
	if err != nil {
		fmt.Println(err)
		return nil
	}

	instructions := make([]string, len(c.Ops))
	for i, o := range c.Ops {
		instructions[i] = fmt.Sprintf("  %s", o)
	}
	return instructions
}
