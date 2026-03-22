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
  const chunks: Uint8Array[] = [];
  let chunkIndex = 0;

  while (true) {
    const chunkUrl = new URL(`${wasmFileName}.${chunkIndex}`, import.meta.url).toString();
    try {
      const response = await fetch(chunkUrl);
      if (!response.ok) {
        if (chunkIndex === 0) {
          // If the first chunk is not found, maybe it's not split. Fall back to original file.
          return new URL(wasmFileName, import.meta.url).toString();
        }
        break;
      }
      const arrayBuffer = await response.arrayBuffer();
      chunks.push(new Uint8Array(arrayBuffer));
      chunkIndex++;
    } catch (e) {
      if (chunkIndex === 0) {
        return new URL(wasmFileName, import.meta.url).toString();
      }
      break;
    }
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combinedWasm = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combinedWasm.set(chunk, offset);
    offset += chunk.length;
  }

  const blob = new Blob([combinedWasm], { type: 'application/wasm' });
  cachedWasmURL = URL.createObjectURL(blob);
  cachedIsShared = useSharedArrayBuffer;
  return cachedWasmURL;
}

export function getFFmpegWorkerURL(useSharedArrayBuffer: boolean): string {
  return useSharedArrayBuffer
    ? new URL('ffmpeg-core-worker-mt.js', import.meta.url).toString()
    : '';
}
