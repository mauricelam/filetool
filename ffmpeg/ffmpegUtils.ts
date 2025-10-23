// Utility functions for FFmpeg URL resolution
// This module isolates import.meta usage so it can be mocked in Jest tests

export function getFFmpegCoreURL(useSharedArrayBuffer: boolean): string {
  return new URL(
    useSharedArrayBuffer ? 'ffmpeg-core-mt.js' : 'ffmpeg-core.js',
    import.meta.url
  ).toString();
}

export function getFFmpegWasmURL(useSharedArrayBuffer: boolean): string {
  return new URL(
    useSharedArrayBuffer ? 'ffmpeg-core-mt.wasm' : 'ffmpeg-core.wasm',
    import.meta.url
  ).toString();
}

export function getFFmpegWorkerURL(useSharedArrayBuffer: boolean): string {
  return useSharedArrayBuffer
    ? new URL('ffmpeg-core-worker-mt.js', import.meta.url).toString()
    : '';
}
