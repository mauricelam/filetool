// Adds TypeScript definitions for MediaStreamTrackProcessor, which is not yet
// included in the standard TypeScript library.

interface MediaStreamTrackProcessorOptions {
  track: MediaStreamVideoTrack;
}

declare class MediaStreamTrackProcessor {
  constructor(options: MediaStreamTrackProcessorOptions);
  readonly readable: ReadableStream<VideoFrame>;
}
