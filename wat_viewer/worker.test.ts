import { fileToWat } from './worker'; // Assuming worker.ts is in the same directory
import wabt from 'wabt';

// Mock the wabt library
jest.mock('wabt', () => {
  const mockToText = jest.fn(() => "(module (func))"); // Predefined string
  const mockReadWasm = jest.fn(() => ({
    toText: mockToText,
    destroy: jest.fn(), // Add a mock destroy function
  }));
  return jest.fn(() => ({
    readWasm: mockReadWasm,
  }));
});

describe('fileToWat', () => {
  it('should process a WASM file and return WAT text', async () => {
    const mockFileContent = new Uint8Array([0x00, 0x61, 0x73, 0x6d]); // Minimal WASM header
    const mockFile = new File([mockFileContent], 'test.wasm', { type: 'application/wasm' });

    const result = await fileToWat(mockFile);

    // Get the mock instances
    const mockWabtInstance = (wabt as jest.Mock).mock.results[0].value;
    const mockReadWasm = mockWabtInstance.readWasm;
    const mockModule = mockReadWasm.mock.results[0].value;

    // Define the expected features object based on worker.ts
    const expectedFeatures = {
      exceptions: true,
      mutable_globals: true,
      sat_float_to_int: true,
      sign_extension: true,
      simd: true,
      threads: true,
      function_references: true,
      multi_value: true,
      tail_call: true,
      bulk_memory: true,
      reference_types: true,
      annotations: true,
      code_metadata: true,
      gc: true,
      memory64: true,
      extended_const: true,
      relaxed_simd: true,
    };

    // Assert that wabt().readWasm was called with the correct arguments
    expect(mockReadWasm).toHaveBeenCalledWith(mockFileContent, expectedFeatures);

    // Assert that module.toText was called
    expect(mockModule.toText).toHaveBeenCalled();

    // Assert that fileToWat returns the predefined string
    expect(result).toBe("(module (func))");
  });
});
