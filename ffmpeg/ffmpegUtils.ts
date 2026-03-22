// Utility functions for FFmpeg URL resolution
// This module isolates import.meta usage so it can be mocked in Jest tests

export function getFFmpegCoreURL(useSharedArrayBuffer: boolean): string {
  return new URL(
    useSharedArrayBuffer ? 'ffmpeg-core-mt.js' : 'ffmpeg-core.js',
    import.meta.url
  ).toString();
}

let cachedWasmURL: string | null = null;
let cachedIsShared: boolean | null = null;

export async function getFFmpegWasmURL(useSharedArrayBuffer: boolean): Promise<string> {
  if (cachedWasmURL && cachedIsShared === useSharedArrayBuffer) {
    return cachedWasmURL;
  }

  const wasmFileName = useSharedArrayBuffer ? 'ffmpeg-core-mt.wasm' : 'ffmpeg-core.wasm';
  const gzipUrl = new URL(`${wasmFileName}.gz`, import.meta.url).toString();

  try {
    const response = await fetch(gzipUrl);
    if (!response.ok) {
      // Fall back to original file if .gz is not found (e.g. in dev mode or if build didn't gzip)
      return new URL(wasmFileName, import.meta.url).toString();
    }

    // Use native DecompressionStream to handle the gzip decompression
    const ds = new (window as any).DecompressionStream('gzip');
    const decompressedStream = response.body!.pipeThrough(ds);
    const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();

    const blob = new Blob([decompressedBuffer], { type: 'application/wasm' });
    cachedWasmURL = URL.createObjectURL(blob);
    cachedIsShared = useSharedArrayBuffer;
    return cachedWasmURL;
  } catch (e) {
    console.warn('Failed to fetch or decompress gzipped WASM, falling back to original:', e);
    return new URL(wasmFileName, import.meta.url).toString();
  }
}

export function getFFmpegWorkerURL(useSharedArrayBuffer: boolean): string {
  return useSharedArrayBuffer
    ? new URL('ffmpeg-core-worker-mt.js', import.meta.url).toString()
    : '';
}
