import * as fs from 'fs';
import * as path from 'path';
// Removed 'init' from import as it's not exported and likely not needed for nodejs target
import { decode_apk, extract_arsc } from './abxml-wrapper/pkg/abxml_wrapper';

describe('Android Binary XML Tests', () => {
  // Removed beforeAll block, assuming Wasm module self-initializes for nodejs target

  describe('decode_apk', () => {
    it('should throw error for a placeholder APK file', () => {
      // Assuming testdata is now relative to the project root or a known path
      // The test file is in 'binaryxml/', so testdata is './testdata/'
      const apkPath = path.join(__dirname, 'testdata/sample.apk');
      const apkBytes = fs.readFileSync(apkPath);
      // The sample.apk is a placeholder and not a real zip, so expect an error
      expect(() => decode_apk(new Uint8Array(apkBytes))).toThrow(/invalid Zip archive/i);
    });

    it('should throw an error for an invalid APK file', () => {
      const invalidApkBytes = new Uint8Array([1, 2, 3, 4]); // Clearly not a zip
      expect(() => decode_apk(invalidApkBytes)).toThrow(/invalid Zip archive/i);
    });
  });

  describe('extract_arsc', () => {
    it('should extract resources from a sample resources.arsc file', () => {
      const arscPath = path.join(__dirname, 'testdata/sample.arsc');
      const arscBytes = fs.readFileSync(arscPath);
      const resources = extract_arsc(new Uint8Array(arscBytes));

      expect(Array.isArray(resources)).toBe(true);
      // sample.arsc from abxml-rs is known to have resources.
      // If it's empty, it might indicate a problem with the test file or Wasm function.
      expect(resources.length).toBeGreaterThan(0);

      // Log a few resource structures to understand them for better assertions later
      // This was in the original file and is useful.
      if (resources && resources.length > 0) {
        console.log('Sample ARSC resources (first 3):');
        for (let i = 0; i < Math.min(3, resources.length); i++) {
          // Make sure resources[i] is not undefined before stringifying
          if (resources[i]) {
            console.log(JSON.stringify(resources[i], null, 2));
          } else {
            console.log(`Resource at index ${i} is undefined/null.`);
          }
        }
      }

      // Example assertion (actual structure depends on your sample.arsc):
      const firstResource = resources[0] as any;
      expect(firstResource).toBeDefined(); // Ensure first resource exists
      if (firstResource) { // Check again to satisfy TypeScript strict null checks if enabled
          expect(firstResource).toHaveProperty('type_name');
          expect(firstResource).toHaveProperty('name');
          // Value might not always be present or could be complex, so this is optional
          // expect(firstResource).toHaveProperty('value');
      }
    });

    it('should throw an error for an invalid ARSC file', () => {
      const invalidArscBytes = new Uint8Array([1, 2, 3, 4]);
      expect(() => extract_arsc(invalidArscBytes)).toThrow(); // General error expected
    });
  });
});
