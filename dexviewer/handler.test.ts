// dexviewer/handler.test.ts
import * as fs from 'fs';
import * as path from 'path';
import * as nodeCrypto from 'crypto'; // For polyfill

declare global {
  var Go: any;
  var godexviewer: {
    createDex: (bytes: Uint8Array) => number;
    getClasses: (id: number) => string[];
    // Add other functions as needed
  };
}

describe('DexViewer Go Wasm Tests', () => {
  let validDexBytes: Uint8Array;
  const goWasmPath = path.join(__dirname, 'godexviewer', 'dextk.wasm');
  const wasmExecPath = path.join(__dirname, 'godexviewer', 'wasm_exec.js');

  beforeAll(async () => {
    try {
         // Use the locally copied valid sample.dex
         const dexPath = path.join(__dirname, 'testdata/valid_sample.dex');
      if (!fs.existsSync(dexPath)) {
           throw new Error(`Valid sample.dex not found at ${dexPath}.`);
      }
      validDexBytes = fs.readFileSync(dexPath);
         console.log(`Successfully read valid dexBytes from ${dexPath}, length: ${validDexBytes.length}`);
    } catch (e) {
      console.error("Error in beforeAll reading sample.dex:", e);
      throw e;
    }

    if (!fs.existsSync(wasmExecPath)) {
        throw new Error(`wasm_exec.js not found at ${wasmExecPath}`);
    }
    if (!fs.existsSync(goWasmPath)) {
        throw new Error(`dextk.wasm not found at ${goWasmPath}`);
    }

    // Polyfill for globalThis.crypto.getRandomValues
    // Ensure require('crypto') is available to the polyfill string
    const cryptoPolyfill = `
      globalThis.crypto = {
        getRandomValues: function(buffer) {
          const nodeCryptoPolyfill = require('crypto');
          const bytes = nodeCryptoPolyfill.randomBytes(buffer.byteLength);
          // Check if buffer is an ArrayBufferView and has a set method
          if (buffer && typeof buffer.set === 'function') {
            buffer.set(bytes);
          } else {
            // Fallback for ArrayBuffer or other types - this might need adjustment
            // depending on what exactly Go's runtime passes to getRandomValues.
            // Assuming it's an ArrayBufferView (like Uint8Array).
            const tempView = new Uint8Array(buffer.buffer || buffer);
            tempView.set(bytes);
          }
          return buffer;
        }
      };
    `;
    const wasmExecScript = fs.readFileSync(wasmExecPath, 'utf8');
    const fullScriptContent = cryptoPolyfill + wasmExecScript;

    // Execute wasm_exec.js in a way that 'Go' becomes global and 'require' is available for the polyfill
    // Pass nodeCrypto to the 'require' argument of the new Function
    new Function('require', fullScriptContent)((moduleName) => {
        if (moduleName === 'crypto') {
            return nodeCrypto;
        }
        // Add other modules if wasm_exec.js needs them, though unlikely for crypto.
        throw new Error(`Module not found: ${moduleName}`);
    });


    if (typeof global.Go === 'undefined') { // Access Go from the actual global object
        throw new Error('Go global object not defined after loading wasm_exec.js');
    }

    const go = new global.Go();
    const buffer = fs.readFileSync(goWasmPath);
    const module = await WebAssembly.compile(buffer);
    const instance = await WebAssembly.instantiate(module, go.importObject);

    const runPromise = go.run(instance);

    runPromise.catch(err => {
        // EPIPE errors can happen if the Go program tries to write to a closed stdout/stderr,
        // or if it exits. This is not necessarily a test failure for this setup.
        if (err && err.message && (err.message.includes("EPIPE") || err.message.includes("Bad file descriptor") || err.message.includes("Go program has already exited"))) {
            console.warn("Go Wasm exited (potentially expected during or after setup):", err.message);
        } else if (err){
            console.error("Error during go.run:", err);
            // We might still want to throw here if it's an unexpected error
            // throw err;
        }
        // If err is null or undefined, it means go.run() resolved without error.
    });

    // Wait a bit for Wasm to initialize and expose globals like 'godexviewer'
    await new Promise(resolve => setTimeout(resolve, 1000)); // Increased timeout slightly

    if (typeof global.godexviewer === 'undefined' || typeof global.godexviewer.createDex === 'undefined') {
        console.error("godexviewer global or createDex function not defined. Globals available:", Object.keys(global));
        // Check if go.run promise resolved with an error that wasn't caught or was ignored
        try {
            await Promise.race([runPromise, new Promise((_, reject) => setTimeout(() => reject(new Error("go.run timeout for check")), 100))]);
        } catch(e) {
            console.error("go.run() promise rejected during check:", e);
        }
        throw new Error('godexviewer global or createDex function not defined after Wasm instantiation and go.run() attempt.');
    }
  });

  it('should create a DEX session and get class names', () => {
    expect(validDexBytes).toBeDefined();
    if (!validDexBytes) throw new Error("validDexBytes is undefined");

    expect(global.godexviewer).toBeDefined();
    expect(typeof global.godexviewer.createDex).toBe('function');
    expect(typeof global.godexviewer.getClasses).toBe('function');

    let dexId: number = -1;
    let error: any = null;
    try {
      dexId = global.godexviewer.createDex(validDexBytes);
    } catch (e) {
      error = e;
      // Using Jest's fail for clarity in test reports
      if (typeof fail === 'function') fail(`Error calling createDex: ${e}`);
      else throw new Error(`Error calling createDex: ${e}`);
    }

    expect(error).toBeNull();
    expect(dexId).toBeGreaterThanOrEqual(0); // Assuming valid ID is non-negative

    let classes: string[] = [];
    try {
      classes = global.godexviewer.getClasses(dexId);
    } catch (e) {
      error = e;
      if (typeof fail === 'function') fail(`Error calling getClasses: ${e}`);
      else throw new Error(`Error calling getClasses: ${e}`);
    }

    expect(error).toBeNull();
    expect(Array.isArray(classes)).toBe(true);
    expect(classes.length).toBeGreaterThan(0); // sample.dex (classes.dex) should have classes

    console.log(`Found ${classes.length} classes. First few:`, classes.slice(0, 5));
    // Using '/' separators as returned by Wasm
    expect(classes).toContain("com/devoteam/quickaction/QuickActionItem");
  });
});
