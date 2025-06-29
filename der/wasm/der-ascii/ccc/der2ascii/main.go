// Copyright 2015 The DER ASCII Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"unicode"
)

var inPath = flag.String("i", "", "input file to use (defaults to stdin)")
var outPath = flag.String("o", "", "output file to use (defaults to stdout)")
var isPEM = flag.Bool("pem", false, "treat the input as PEM and decode the first PEM block")
var isPEMAll = flag.Bool("pem-all", false, "treat the input as PEM and decode all PEM blocks")
var pemPassword = flag.String("pem-password", "", "password to use when decrypting PEM blocks")
var isHex = flag.Bool("hex", false, "treat the input as hex, ignoring punctuation and whitespace")

type input struct {
	comment string
	bytes   []byte
}

func main() {
	flag.Parse()

	if flag.NArg() > 0 {
		fmt.Fprintf(os.Stderr, "Usage: %s [OPTION...]\n", os.Args[0])
		flag.PrintDefaults()
		os.Exit(1)
	}

	inFile := os.Stdin
	if *inPath != "" {
		var err error
		inFile, err = os.Open(*inPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error opening %s: %s\n", *inPath, err)
			os.Exit(1)
		}
		defer inFile.Close()
	}

	inBytes, err := ioutil.ReadAll(inFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading input: %s\n", err)
		os.Exit(1)
	}

	if *pemPassword != "" && !*isPEM && !*isPEMAll {
		fmt.Fprintf(os.Stderr, "-pem-password provided, but neither -pem nor -pem-all provided\n")
		os.Exit(1)
	}

	var inputs []input
	if *isPEMAll {
		for len(inBytes) > 0 {
			var pemBlock *pem.Block
			pemBlock, inBytes = pem.Decode(inBytes)
			if pemBlock == nil {
				break
			}
			if *pemPassword != "" {
				bytes, err := x509.DecryptPEMBlock(pemBlock, []byte(*pemPassword))
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error decrypting PEM block: %s\n", err)
					os.Exit(1)
				}
				inputs = append(inputs, input{comment: pemBlock.Type, bytes: bytes})
			} else {
				inputs = append(inputs, input{comment: pemBlock.Type, bytes: pemBlock.Bytes})
			}
		}
		if len(inputs) == 0 {
			fmt.Fprintf(os.Stderr, "-pem-all provided, but input could not be parsed as PEM\n")
			os.Exit(1)
		}
	} else if *isPEM {
		pemBlock, _ := pem.Decode(inBytes)
		if pemBlock == nil {
			fmt.Fprintf(os.Stderr, "-pem provided, but input could not be parsed as PEM\n")
			os.Exit(1)
		}
		if *pemPassword != "" {
			bytes, err := x509.DecryptPEMBlock(pemBlock, []byte(*pemPassword))
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error decrypting PEM block: %s\n", err)
				os.Exit(1)
			}
			inputs = []input{{bytes: bytes}}
		} else {
			inputs = []input{{bytes: pemBlock.Bytes}}
		}
	} else if *isHex {
		stripped := strings.Map(func(r rune) rune {
			if unicode.IsSpace(r) || unicode.IsPunct(r) {
				return -1
			}
			return r
		}, string(inBytes))
		inBytes, err = hex.DecodeString(stripped)
		if err != nil {
			fmt.Fprintf(os.Stderr, "-hex provided, but input could not be parsed as hex: %s\n", err)
			os.Exit(1)
		}
		inputs = []input{{bytes: inBytes}}
	} else {
		inputs = []input{{bytes: inBytes}}
	}

	outFile := os.Stdout
	if *outPath != "" {
		outFile, err = os.Create(*outPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error opening %s: %s\n", *outPath, err)
			os.Exit(1)
		}
		defer outFile.Close()
	}
	for i, inp := range inputs {
		if len(inp.comment) > 0 {
			if i > 0 {
				if _, err := outFile.WriteString("\n"); err != nil {
					fmt.Fprintf(os.Stderr, "Error writing output: %s\n", err)
					os.Exit(1)
				}
			}
			if _, err := fmt.Fprintf(outFile, "# %s\n", inp.comment); err != nil {
				fmt.Fprintf(os.Stderr, "Error writing output: %s\n", err)
				os.Exit(1)
			}
		}
		if _, err := outFile.WriteString(DerToASCII(inp.bytes)); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing output: %s\n", err)
			os.Exit(1)
		}
	}
}
