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

type StringPool struct {
	Strings []string
	Lowers  []string
	Lookup  map[string]uint32
}

func (p *StringPool) GetID(s string) uint32 {
	if id, ok := p.Lookup[s]; ok {
		return id
	}
	id := uint32(len(p.Strings))
	p.Strings = append(p.Strings, s)
	p.Lowers = append(p.Lowers, strings.ToLower(s))
	if p.Lookup == nil {
		p.Lookup = make(map[string]uint32)
	}
	p.Lookup[s] = id
	return id
}

func (p *StringPool) Clear() {
	p.Strings = nil
	p.Lowers = nil
	p.Lookup = nil
}

var globalStringPool StringPool

type IndexedMethod struct {
	NameID           uint32
	InstructionStart uint32
	InstructionEnd   uint32
}

type IndexedClass struct {
	NameID      uint32
	MethodStart uint32
	MethodEnd   uint32
}

type IndexedDex struct {
	Classes      []IndexedClass
	Methods      []IndexedMethod
	Instructions []uint32
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
	globalStringPool.Clear()
	return js.Null()
}

func buildIndex(this js.Value, args []js.Value) any {
	globalStringPool.Clear()
	fullIndex = make([]IndexedDex, len(cachedReaders))

	for dexIdx, reader := range cachedReaders {
		dex := IndexedDex{
			Classes:      make([]IndexedClass, reader.ClassDefCount),
			Methods:      make([]IndexedMethod, 0),
			Instructions: make([]uint32, 0),
		}

		for i := uint32(0); i < reader.ClassDefCount; i++ {
			class, err := reader.ReadClassAndParse(i)
			if err != nil {
				continue
			}

			indexedClass := IndexedClass{
				NameID:      globalStringPool.GetID(class.Name.String()),
				MethodStart: uint32(len(dex.Methods)),
			}

			processMethods := func(methods []dextk.MethodNode) {
				for _, method := range methods {
					if method.CodeOff == 0 {
						continue
					}

					code, err := reader.ReadCodeAndParse(method.CodeOff)
					if err != nil {
						continue
					}

					indexedMethod := IndexedMethod{
						NameID:           globalStringPool.GetID(method.Name.String()),
						InstructionStart: uint32(len(dex.Instructions)),
					}

					for _, op := range code.Ops {
						ins := fmt.Sprintf("  %s", op)
						dex.Instructions = append(dex.Instructions, globalStringPool.GetID(ins))
					}
					indexedMethod.InstructionEnd = uint32(len(dex.Instructions))
					dex.Methods = append(dex.Methods, indexedMethod)
				}
			}

			processMethods(class.DirectMethods)
			processMethods(class.VirtualMethods)
			indexedClass.MethodEnd = uint32(len(dex.Methods))
			dex.Classes[i] = indexedClass
		}
		fullIndex[dexIdx] = dex
	}

	// Clear lookup map to save memory after indexing is done
	globalStringPool.Lookup = nil

	return js.Null()
}

func getIndexMemoryUsage(this js.Value, args []js.Value) any {
	var total uint64
	// String pool memory
	for _, s := range globalStringPool.Strings {
		total += 16 + uint64(len(s))
	}
	for _, s := range globalStringPool.Lowers {
		total += 16 + uint64(len(s))
	}
	total += uint64(len(globalStringPool.Strings)) * 8 * 2 // slice overhead for Strings and Lowers

	// Index structures memory
	for _, dex := range fullIndex {
		total += 24                                    // Classes slice header
		total += uint64(len(dex.Classes)) * 12         // IndexedClass size
		total += 24                                    // Methods slice header
		total += uint64(len(dex.Methods)) * 12         // IndexedMethod size
		total += 24                                    // Instructions slice header
		total += uint64(len(dex.Instructions)) * 4      // uint32 size
	}
	total += uint64(len(fullIndex)) * 72 // IndexedDex struct size (3 slices * 24)

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
		// Pre-match strings in the pool
		matchingIDs := make([]bool, len(globalStringPool.Strings))
		for i, sLower := range globalStringPool.Lowers {
			if strings.Contains(sLower, queryLower) || strings.Contains(sLower, querySlashes) {
				matchingIDs[i] = true
			}
		}

		for dexIdx, dex := range fullIndex {
			for classIdx, class := range dex.Classes {
				for mIdx := class.MethodStart; mIdx < class.MethodEnd; mIdx++ {
					method := dex.Methods[mIdx]
					for iIdx := method.InstructionStart; iIdx < method.InstructionEnd; iIdx++ {
						insID := dex.Instructions[iIdx]
						if matchingIDs[insID] {
							results = append(results, js.ValueOf(map[string]any{
								"className":   globalStringPool.Strings[class.NameID],
								"methodName":  globalStringPool.Strings[method.NameID],
								"instruction": globalStringPool.Strings[insID],
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
