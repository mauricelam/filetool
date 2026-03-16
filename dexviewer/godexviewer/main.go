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

var cachedReaders []*dextk.Reader
var cachedBytes [][]byte

type IndexedMethod struct {
	Name         string
	Instructions []string
}

type IndexedClass struct {
	Name    string
	Methods []IndexedMethod
}

type IndexedDex struct {
	Classes []IndexedClass
}

var fullIndex []IndexedDex

func main() {
	// Create dextk object to store functions
	dextkObj := map[string]interface{}{
		"setFileData":           js.FuncOf(setFileData),
		"addFileData":           js.FuncOf(addFileData),
		"clearFileData":         js.FuncOf(clearFileData),
		"searchUsages":          js.FuncOf(searchUsages),
		"getMethodInstructions": js.FuncOf(getMethodInstructions),
		"buildIndex":            js.FuncOf(buildIndex),
		"getIndexMemoryUsage":   js.FuncOf(getIndexMemoryUsage),
	}

	// Export dextk object to JavaScript
	js.Global().Set("godexviewer", js.ValueOf(dextkObj))

	// Keep the Go program running
	<-make(chan bool)
}

func setFileData(this js.Value, args []js.Value) any {
	clearFileData(this, nil)
	return addFileData(this, args)
}

func addFileData(this js.Value, args []js.Value) any {
	array := args[0]
	dexbytes := make([]byte, array.Length())
	js.CopyBytesToGo(dexbytes, array)

	r, err := dextk.Read(bytes.NewReader(dexbytes))
	if err != nil {
		fmt.Println("Error reading DEX:", err)
		return js.ValueOf(err.Error())
	}

	cachedReaders = append(cachedReaders, r)
	cachedBytes = append(cachedBytes, dexbytes)
	return js.Null()
}

func clearFileData(this js.Value, args []js.Value) any {
	cachedReaders = nil
	cachedBytes = nil
	fullIndex = nil
	return js.Null()
}

func buildIndex(this js.Value, args []js.Value) any {
	fullIndex = make([]IndexedDex, len(cachedReaders))
	for dexIdx, reader := range cachedReaders {
		dex := IndexedDex{
			Classes: make([]IndexedClass, reader.ClassDefCount),
		}
		for i := uint32(0); i < reader.ClassDefCount; i++ {
			class, err := reader.ReadClassAndParse(i)
			if err != nil {
				continue
			}
			indexedClass := IndexedClass{
				Name: class.Name.String(),
			}

			processMethods := func(methods []dextk.MethodNode) []IndexedMethod {
				indexedMethods := make([]IndexedMethod, 0, len(methods))
				for _, method := range methods {
					if method.CodeOff == 0 {
						continue
					}
					instructions := getInstructions(reader, method)
					if instructions != nil {
						indexedMethods = append(indexedMethods, IndexedMethod{
							Name:         method.Name.String(),
							Instructions: instructions,
						})
					}
				}
				return indexedMethods
			}

			indexedClass.Methods = append(processMethods(class.DirectMethods), processMethods(class.VirtualMethods)...)
			dex.Classes[i] = indexedClass
		}
		fullIndex[dexIdx] = dex
	}
	return js.Null()
}

func getIndexMemoryUsage(this js.Value, args []js.Value) any {
	var total uint64
	for _, dex := range fullIndex {
		total += 24 // slice header for Classes
		for _, class := range dex.Classes {
			total += 16 + uint64(len(class.Name)) // Name string
			total += 24                           // slice header for Methods
			for _, method := range class.Methods {
				total += 16 + uint64(len(method.Name)) // Name string
				total += 24                            // slice header for Instructions
				for _, ins := range method.Instructions {
					total += 16 + uint64(len(ins)) // Instruction string
				}
			}
		}
	}
	return js.ValueOf(total)
}

func searchUsages(this js.Value, args []js.Value) any {
	if len(cachedReaders) == 0 {
		return js.ValueOf([]any{})
	}

	query := args[0].String()
	if query == "" {
		return js.ValueOf([]any{})
	}
	queryLower := strings.ToLower(query)
	querySlashes := strings.ReplaceAll(queryLower, ".", "/")

	var results []any

	if fullIndex != nil {
		for dexIdx, dex := range fullIndex {
			for classIdx, class := range dex.Classes {
				for _, method := range class.Methods {
					for _, ins := range method.Instructions {
						insLower := strings.ToLower(ins)
						if strings.Contains(insLower, queryLower) || strings.Contains(insLower, querySlashes) {
							results = append(results, js.ValueOf(map[string]any{
								"className":   class.Name,
								"methodName":  method.Name,
								"instruction": ins,
								"classId":     classIdx,
								"dexIndex":    dexIdx,
							}))
						}
					}
				}
			}
		}
		return js.ValueOf(results)
	}

	for dexIdx, reader := range cachedReaders {
		// Optimization: pre-filter string and type IDs
		matchingStrings := make(map[uint32]bool)
		for i := uint32(0); i < reader.StringIDCount; i++ {
			s, err := reader.ReadString(i)
			if err != nil {
				continue
			}
			sStr := s.String()
			sLower := strings.ToLower(sStr)
			if strings.Contains(sLower, queryLower) || strings.Contains(sLower, querySlashes) {
				matchingStrings[i] = true
			}
		}

		matchingTypes := make(map[uint16]bool)
		for i := uint32(0); i < uint32(reader.TypeIDCount); i++ {
			t, err := reader.ReadType(i)
			if err != nil {
				continue
			}
			if matchingStrings[t.DescriptorStringID] {
				matchingTypes[uint16(i)] = true
			}
		}

		for i := uint32(0); i < reader.ClassDefCount; i++ {
			class, err := reader.ReadClassAndParse(i)
			if err != nil {
				continue
			}

			checkMethods := func(methods []dextk.MethodNode) {
				for _, method := range methods {
					if method.CodeOff == 0 {
						continue
					}

					code, err := reader.ReadCodeAndParse(method.CodeOff)
					if err != nil {
						continue
					}

					for _, op := range code.Ops {
						found := false
						// Use op.String() which is relatively fast and includes all IDs resolved
						// But we can pre-check some IDs if we had access to them in op.
						// Since dextk hides some implementation details, string search on disassembly
						// is currently the most reliable way to match resolved IDs.
						ins := fmt.Sprintf("  %s", op)
						insLower := strings.ToLower(ins)

						if strings.Contains(insLower, queryLower) || strings.Contains(insLower, querySlashes) {
							found = true
						}

						if found {
							results = append(results, js.ValueOf(map[string]any{
								"className":   class.Name.String(),
								"methodName":  method.Name.String(),
								"instruction": ins,
								"classId":     i,
								"dexIndex":    dexIdx,
							}))
						}
					}
				}
			}

			checkMethods(class.DirectMethods)
			checkMethods(class.VirtualMethods)
		}
	}

	return js.ValueOf(results)
}

func getMethodInstructions(this js.Value, args []js.Value) any {
	var r *dextk.Reader
	var classId int
	var methodName string

	if len(args) == 4 {
		// New signature: (dummy, dexIndex, classId, methodName)
		dexIdx := args[1].Int()
		classId = args[2].Int()
		methodName = args[3].String()

		if dexIdx >= 0 && dexIdx < len(cachedReaders) {
			r = cachedReaders[dexIdx]
		} else {
			fmt.Println("Invalid dex index:", dexIdx)
			return nil
		}
	} else {
		// Old signature: (dexBytes, classId, methodName)
		classId = args[1].Int()
		methodName = args[2].String()

		// Get the Uint8Array from JavaScript
		array := args[0]
		// Create Go byte slice and copy data
		dexbytes := make([]byte, array.Length())
		js.CopyBytesToGo(dexbytes, array)
		var err error
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
