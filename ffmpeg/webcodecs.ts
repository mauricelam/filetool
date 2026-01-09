// This file will contain the logic for transcoding video using the WebCodecs API.
import MP4Box from 'mp4box';

export async function transcode(file: File, encoderConfig: VideoEncoderConfig): Promise<Blob> {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    video.muted = true;

    const mp4boxfile = MP4Box.createFile();
    let videoTrack: number;

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
                    output: (chunk, metadata) => {
                        if (metadata.decoderConfig && metadata.decoderConfig.description) {
                            const trackOptions = {
                                timescale: 1_000_000, // Timestamps are in microseconds
                                width: video.videoWidth,
                                height: video.videoHeight,
                                codec: encoderConfig.codec,
                                description: metadata.decoderConfig.description,
                            };
                            videoTrack = mp4boxfile.addTrack(trackOptions);
                        }
                        const buffer = new ArrayBuffer(chunk.byteLength);
                        chunk.copyTo(buffer);
                        mp4boxfile.addSample(videoTrack, buffer, {
                            duration: chunk.duration,
                            dts: chunk.timestamp,
                            cts: chunk.timestamp,
                            is_sync: chunk.type === 'key',
                        });
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

                const buffer = mp4boxfile.getBuffer();
                resolve(new Blob([buffer], { type: 'video/mp4' }));

                URL.revokeObjectURL(videoUrl);

            } catch (e) {
                reject(e);
            }
        };

        video.play();
    });
}
