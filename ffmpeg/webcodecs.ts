// This file will contain the logic for transcoding video using the WebCodecs API.

export async function transcode(file: File, encoderConfig: VideoEncoderConfig): Promise<Blob> {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    video.muted = true;

    const chunks: ArrayBuffer[] = [];

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
                }

                await encoder.flush();

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
