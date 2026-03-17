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

type IndexEntry struct {
	dexIdx           int
	classId          uint32
	className        string
	methodName       string
	instruction      string
	instructionLower string
}

var searchIndex []IndexEntry

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
	searchIndex = nil
	return js.Null()
}

func buildIndex(this js.Value, args []js.Value) any {
	searchIndex = nil
	for dexIdx, reader := range cachedReaders {
		for i := uint32(0); i < reader.ClassDefCount; i++ {
			class, err := reader.ReadClassAndParse(i)
			if err != nil {
				continue
			}
			className := class.Name.String()

			addMethods := func(methods []dextk.MethodNode) {
				for _, method := range methods {
					if method.CodeOff == 0 {
						continue
					}
					methodName := method.Name.String()

					code, err := reader.ReadCodeAndParse(method.CodeOff)
					if err != nil {
						continue
					}

					for _, op := range code.Ops {
						ins := fmt.Sprintf("  %s", op)
						searchIndex = append(searchIndex, IndexEntry{
							dexIdx:           dexIdx,
							classId:          i,
							className:        className,
							methodName:       methodName,
							instruction:      ins,
							instructionLower: strings.ToLower(ins),
						})
					}
				}
			}
			addMethods(class.DirectMethods)
			addMethods(class.VirtualMethods)
		}
	}
	return js.Null()
}

func getIndexMemoryUsage(this js.Value, args []js.Value) any {
	var totalSize uintptr
	for _, entry := range searchIndex {
		totalSize += uintptr(len(entry.className))
		totalSize += uintptr(len(entry.methodName))
		totalSize += uintptr(len(entry.instruction))
		totalSize += uintptr(len(entry.instructionLower))
		totalSize += 48 // approximate overhead per struct
	}
	// Return in MB
	return js.ValueOf(float64(totalSize) / 1024 / 1024)
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

	if len(searchIndex) > 0 {
		for _, entry := range searchIndex {
			if strings.Contains(entry.instructionLower, queryLower) || strings.Contains(entry.instructionLower, querySlashes) {
				results = append(results, js.ValueOf(map[string]any{
					"className":   entry.className,
					"methodName":  entry.methodName,
					"instruction": entry.instruction,
					"classId":     entry.classId,
					"dexIndex":    entry.dexIdx,
				}))
			}
		}
		return js.ValueOf(results)
	}

	// Fallback to slow search if index not built
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
						ins := fmt.Sprintf("  %s", op)
						insLower := strings.ToLower(ins)

						if strings.Contains(insLower, queryLower) || strings.Contains(insLower, querySlashes) {
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
