// Mock implementation of ffmpegUtils for Jest tests
export function getFFmpegCoreURL(useSharedArrayBuffer: boolean): string {
  return useSharedArrayBuffer ? 'mocked-ffmpeg-core-mt.js' : 'mocked-ffmpeg-core.js';
}

export function getFFmpegWasmURL(useSharedArrayBuffer: boolean): string {
  return useSharedArrayBuffer ? 'mocked-ffmpeg-core-mt.wasm' : 'mocked-ffmpeg-core.wasm';
}

export function getFFmpegWorkerURL(useSharedArrayBuffer: boolean): string {
  return useSharedArrayBuffer ? 'mocked-ffmpeg-core-worker-mt.js' : '';
}
