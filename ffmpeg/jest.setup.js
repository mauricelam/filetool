// Jest setup file for ffmpeg tests
require('@testing-library/jest-dom');

// Mock window.URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File constructor for testing
global.File = class MockFile {
  constructor(bits, name, options = {}) {
    this.bits = bits;
    this.name = name;
    this.type = options.type || '';
    this.size = options.size || bits.reduce((acc, bit) => acc + bit.length, 0);
    this.lastModified = options.lastModified || Date.now();
  }

  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
};

// Mock SharedArrayBuffer availability
Object.defineProperty(window, 'SharedArrayBuffer', {
  value: ArrayBuffer,
  writable: true
});
