export async function transcode(
    file: File,
    encoderConfig: VideoEncoderConfig,
    totalFrames: number,
    onProgress: (progress: number) => void
): Promise<Blob> {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    video.muted = true;

    const chunks: ArrayBuffer[] = [];
    let processedFrames = 0;

    return new Promise((resolve, reject) => {
        video.onerror = (e) => reject(video.error);

        video.onloadedmetadata = async () => {
            try {
                encoderConfig.width = video.videoWidth;
                encoderConfig.height = video.videoHeight;

                const track = video.captureStream().getVideoTracks()[0];
                const processor = new MediaStreamTrackProcessor({ track });
                const frameStream = processor.readable;

                const encoder = new VideoEncoder({
                    output: (chunk) => {
                        const chunkData = new ArrayBuffer(chunk.byteLength);
                        chunk.copyTo(chunkData);
                        chunks.push(chunkData);
                    },
                    error: (e) => {
                        reject(e);
                    },
                });

                encoder.configure(encoderConfig);

                const reader = frameStream.getReader();
                while (true) {
                    const { done, value: frame } = await reader.read();
                    if (done) {
                        break;
                    }
                    if (encoder.encodeQueueSize <= 30) {
                        encoder.encode(frame);
                    } else {
                        await new Promise(r => setTimeout(r, 10));
                        encoder.encode(frame);
                    }
                    frame.close();

                    processedFrames++;
                    if (totalFrames > 0) {
                        onProgress(processedFrames / totalFrames);
                    }
                }

                await encoder.flush();
                onProgress(1);

                resolve(new Blob(chunks));

            } catch (e) {
                reject(e);
            } finally {
                URL.revokeObjectURL(videoUrl);
            }
        };

        video.play();
    });
}
