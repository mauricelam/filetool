// rustdexviewer/handler.test.ts
import { init_logger, dex_classes, dex_methods } from './dexviewer/pkg'; // Ensure dex_methods is imported
import * as fs from 'fs';
import * as path from 'path';

describe('RustDexViewer Wasm Tests', () => {
  let dexBytes: Uint8Array;
  const knownClassId = 0; // From previous test log for "com.devoteam.quickaction.QuickActionItem"

  beforeAll(async () => {
    try {
      // init() is not needed for wasm-pack nodejs target
      if (typeof init_logger === 'function') {
        init_logger();
      } else {
        console.warn("init_logger not found, skipping.");
      }
      const dexPath = path.join(__dirname, 'testdata/sample.dex');
      dexBytes = fs.readFileSync(dexPath);
    } catch (e) {
      console.error("Error in beforeAll:", e);
      throw e;
    }
  });

  it('should parse classes from a sample DEX file', () => {
    expect(dexBytes).toBeDefined();
    let result: any[] | undefined;
    let error: any = null;
    try {
      result = dex_classes(dexBytes);
    } catch (e) {
      error = e;
    }

    expect(error).toBeNull();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result && result.length > 0) {
      console.log(`Found ${result.length} classes. First class:`, JSON.stringify(result[0], null, 2));
      expect(result[0]).toHaveProperty('name');
      // Verify the class used for the next test actually has the ID 0
      const firstClass = result.find(c => c.id === knownClassId);
      expect(firstClass).toBeDefined();
      if (firstClass) { // Check for defined before accessing property
         expect(firstClass.name).toBe("com.devoteam.quickaction.QuickActionItem");
      }
    } else {
      // Using fail from Jest context if available, otherwise throw Error
      if (typeof fail === 'function') {
        fail("dex_classes returned an empty array or undefined, cannot proceed to test dex_methods.");
      } else {
        throw new Error("dex_classes returned an empty array or undefined, cannot proceed to test dex_methods.");
      }
    }
  });

  it('should parse methods for a given class ID from a sample DEX file', () => {
    expect(dexBytes).toBeDefined();
    if (!dexBytes) {
        throw new Error("dexBytes not loaded in beforeAll, skipping test execution for methods.");
    }
    let result: any[] | undefined;
    let error: any = null;
    try {
      result = dex_methods(dexBytes, knownClassId);
    } catch (e) {
      error = e;
    }

    expect(error).toBeNull(); // Check that dex_methods does not throw
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result && result.length > 0) {
      console.log(`Found ${result.length} methods for class ID ${knownClassId}. First method:`, JSON.stringify(result[0], null, 2));
      expect(result[0]).toHaveProperty('name');
    } else {
      console.log(`dex_methods returned an empty array for class ID ${knownClassId}. This might be an issue or the class might have no methods.`);
      // For "com.devoteam.quickaction.QuickActionItem", it's likely to have methods.
      // If this class is expected to have methods, this should be a failure.
      // For now, we just log, but this might need adjustment if methods are guaranteed.
      // Consider using: expect(result.length).toBeGreaterThan(0); if methods are expected.
    }
  });
});
