#!/bin/bash

set -ex

source ../../emsdk/emsdk_env.sh

emcc -O3 -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="['_malloc', '_free', '_lzfse_decode_buffer']" ../lzfse/lzfse.c -o ../dist/lzfse/lzfse.wasm

hexdump -v -e '"%u,"' ../dist/lzfse/lzfse.wasm > ../dist/lzfse/lzfse.wasm.h
