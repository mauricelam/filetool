package main

import (
	"bytes"
	"fmt"
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
		"getMethodInstructions": js.FuncOf(getMethodInstructions),
	}

	// Export dextk object to JavaScript
	js.Global().Set("godexviewer", js.ValueOf(dextkObj))

	// Keep the Go program running
	<-make(chan bool)
}

func getMethodInstructions(this js.Value, args []js.Value) any {
	// Get the Uint8Array from JavaScript
	array := args[0]
	// Get the class ID from JavaScript
	classId := args[1].Int()
	// Get the method name from JavaScript
	methodName := args[2].String()

	// Create Go byte slice and copy data
	dexbytes := make([]byte, array.Length())
	js.CopyBytesToGo(dexbytes, array)
	r, err := dextk.Read(bytes.NewReader(dexbytes))
	if err != nil {
		fmt.Println(err)
		return nil
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
