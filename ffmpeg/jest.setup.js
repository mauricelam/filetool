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

// Mock window.parent and postMessage
Object.defineProperty(window, 'parent', {
  value: {
    postMessage: jest.fn()
  },
  writable: true
});

// Mock DOM elements for React
document.body.innerHTML = '<div id="output"></div>';

// Mock FFmpeg library to avoid webpack publicPath issues
jest.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: jest.fn().mockImplementation(() => {
    let logCallback = null;
    return {
      load: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      exec: jest.fn().mockImplementation(async (args) => {
        // Mock FFmpeg output for video analysis
        if (args.includes('-i') && logCallback) {
          const mockOutput = `
ffmpeg version 6.0 Copyright (c) 2000-2023 the FFmpeg developers
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'big_buck_bunny.mp4':
  Duration: 00:01:00.05, start: 0.000000, bitrate: 677 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 640x360, 612 kb/s, 23.96 fps, 23.96 tbr, 24k tbn (default)
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 22050 Hz, stereo, fltp, 65 kb/s (default)
At least one output file must be specified`;
          
          // Simulate log messages
          mockOutput.split('\n').forEach(line => {
            if (line.trim()) {
              logCallback({ message: line });
            }
          });
        }
        return Promise.resolve();
      }),
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'log') {
          logCallback = callback;
        }
      }),
      readFile: jest.fn().mockResolvedValue(new Uint8Array()),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      terminate: jest.fn().mockResolvedValue(undefined)
    };
  })
}));
