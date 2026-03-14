package main

import (
	"bytes"
	"fmt"
	"strings"
	"syscall/js"

	"github.com/csnewman/dextk"
)

var cachedReader *dextk.Reader
var cachedBytes []byte

func main() {
	// Create dextk object to store functions
	dextkObj := map[string]interface{}{
		"setFileData":           js.FuncOf(setFileData),
		"searchUsages":          js.FuncOf(searchUsages),
		"getMethodInstructions": js.FuncOf(getMethodInstructions),
	}

	// Export dextk object to JavaScript
	js.Global().Set("godexviewer", js.ValueOf(dextkObj))

	// Keep the Go program running
	<-make(chan bool)
}

func setFileData(this js.Value, args []js.Value) any {
	array := args[0]
	dexbytes := make([]byte, array.Length())
	js.CopyBytesToGo(dexbytes, array)

	r, err := dextk.Read(bytes.NewReader(dexbytes))
	if err != nil {
		fmt.Println("Error reading DEX:", err)
		return js.ValueOf(err.Error())
	}

	cachedReader = r
	cachedBytes = dexbytes
	return js.Null()
}

func searchUsages(this js.Value, args []js.Value) any {
	if cachedReader == nil {
		return js.ValueOf([]any{})
	}

	query := args[0].String()
	if query == "" {
		return js.ValueOf([]any{})
	}
	queryLower := strings.ToLower(query)
	querySlashes := strings.ReplaceAll(queryLower, ".", "/")

	var results []any

	for i := uint32(0); i < cachedReader.ClassDefCount; i++ {
		class, err := cachedReader.ReadClassAndParse(i)
		if err != nil {
			continue
		}

		checkMethods := func(methods []dextk.MethodNode) {
			for _, method := range methods {
				if method.CodeOff == 0 {
					continue
				}
				instructions := getInstructions(cachedReader, method)
				for _, ins := range instructions {
					insLower := strings.ToLower(ins)
					if strings.Contains(insLower, queryLower) || strings.Contains(insLower, querySlashes) {
						results = append(results, js.ValueOf(map[string]any{
							"className":   class.Name.String(),
							"methodName":  method.Name.String(),
							"instruction": ins,
							"classId":     i,
						}))
					}
				}
			}
		}

		checkMethods(class.DirectMethods)
		checkMethods(class.VirtualMethods)
	}

	return js.ValueOf(results)
}

func getMethodInstructions(this js.Value, args []js.Value) any {
	// Get the class ID from JavaScript
	classId := args[1].Int()
	// Get the method name from JavaScript
	methodName := args[2].String()

	var r *dextk.Reader
	var err error

	if cachedReader != nil {
		r = cachedReader
	} else {
		// Get the Uint8Array from JavaScript
		array := args[0]
		// Create Go byte slice and copy data
		dexbytes := make([]byte, array.Length())
		js.CopyBytesToGo(dexbytes, array)
		r, err = dextk.Read(bytes.NewReader(dexbytes))
		if err != nil {
			fmt.Println(err)
			return nil
		}
	}

	// Find the method in the class
	class, err := r.ReadClassAndParse(uint32(classId))
	if err != nil {
		fmt.Println(err)
		return nil
	}

	fmt.Println("Class id:", classId, "Class name:", class.Name.String())

	// Check direct methods
	for _, method := range class.DirectMethods {
		fmt.Println("Direct method:", method.Name.String(), "Method name:", methodName)
		if method.Name.String() == methodName {
			return js.ValueOf(stringSliceToAnySlice(getInstructions(r, method)))
		}
	}
	// Check virtual methods
	for _, method := range class.VirtualMethods {
		fmt.Println("Virtual method:", method.Name.String(), "Method name:", methodName)
		if method.Name.String() == methodName {
			return js.ValueOf(stringSliceToAnySlice(getInstructions(r, method)))
		}
	}

	fmt.Println("Method not found")
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
