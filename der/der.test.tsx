import { describe, expect, test, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

// Declare global Go and derToAscii for TypeScript
declare global {
  interface Window {
    derToAscii: (data: Uint8Array) => string;
    Go: any;
  }
}

describe('der', () => {
  beforeAll(async () => {
    // Load wasm_exec.js
    const wasmExecJsPath = join(__dirname, '..', 'dist', 'der', 'wasm_exec.js');
    const wasmExecJsContent = readFileSync(wasmExecJsPath, 'utf-8');
    // Execute wasm_exec.js in the current global scope
    eval(wasmExecJsContent);

    const go = new window.Go();
    const wasmPath = join(__dirname, '..', 'dist', 'der', 'der.wasm');
    const wasmBytes = readFileSync(wasmPath);

    const result = await WebAssembly.instantiate(wasmBytes, go.importObject);
    go.run(result.instance);
  });

  test('derToAscii with simple DER', () => {
    const der = new Uint8Array([
      0x30, 0x0c, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02, 0x02, 0x01, 0x03, 0x02,
      0x01, 0x04,
    ]);
    const ascii = window.derToAscii(der);
    expect(ascii).toBe(
      `SEQUENCE {
  INTEGER { 1 }
  INTEGER { 2 }
  INTEGER { 3 }
  INTEGER { 4 }
}
`
    );
  });

  test('derToAscii with cert file', () => {
    const certPath = join(__dirname, 'example', 'cert');
    const certBytes = new Uint8Array(readFileSync(certPath));
    const ascii = window.derToAscii(certBytes);
    // This will initially fail, and we'll use the output to update the expected string.
    const expectedOutput = readFileSync(join(__dirname, 'example', 'cert.output.txt'), 'utf-8');
    expect(ascii).toBe(expectedOutput);
  });
});