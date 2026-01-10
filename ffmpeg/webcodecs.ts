import * as mp4box from 'mp4box';

export function getH264AnnexBHeaders(description: ArrayBuffer): Uint8Array {
    const view = new DataView(description);
    let dpos = 5;
    const numSps = view.getUint8(dpos++) & 0x1f;
    const nalus: Uint8Array[] = [];
    const source = new Uint8Array(description);

    for (let i = 0; i < numSps; i++) {
        const len = view.getUint16(dpos);
        dpos += 2;
        nalus.push(source.slice(dpos, dpos + len));
        dpos += len;
    }
    const numPps = view.getUint8(dpos++) & 0xff;
    for (let i = 0; i < numPps; i++) {
        const len = view.getUint16(dpos);
        dpos += 2;
        nalus.push(source.slice(dpos, dpos + len));
        dpos += len;
    }

    const totalLen = nalus.reduce((acc, n) => acc + n.length + 4, 0);
    const finalBuf = new Uint8Array(totalLen);
    let offset = 0;
    for (const n of nalus) {
        finalBuf[offset++] = 0;
        finalBuf[offset++] = 0;
        finalBuf[offset++] = 0;
        finalBuf[offset++] = 1;
        finalBuf.set(n, offset);
        offset += n.length;
    }
    return finalBuf;
}

export function generateIVFHeader(config: { codec: string, width: number, height: number }, totalFrames: number, duration: number): ArrayBuffer {
    const ivfHeader = new ArrayBuffer(32);
    const view = new DataView(ivfHeader);
    view.setUint8(0, 0x44); // D
    view.setUint8(1, 0x4b); // K
    view.setUint8(2, 0x49); // I
    view.setUint8(3, 0x46); // F
    view.setUint16(4, 0, true); // version
    view.setUint16(6, 32, true); // header length
    const fourcc = config.codec.startsWith('vp8') ? 'VP80' : 'VP90';
    for (let i = 0; i < 4; i++) view.setUint8(8 + i, fourcc.charCodeAt(i));
    view.setUint16(12, config.width, true);
    view.setUint16(14, config.height, true);

    // Use a fixed 1000/1 timebase so pts is always millisecond
    view.setUint32(16, 1000, true); // rate
    view.setUint32(20, 1, true);    // scale
    view.setUint32(24, totalFrames, true);
    view.setUint32(28, 0, true); // unused
    return ivfHeader;
}

async function demuxAudioTrack(file: File): Promise<{ chunks: EncodedAudioChunk[], config: AudioDecoderConfig }> {
    const demuxer = mp4box.createFile();
    const chunks: EncodedAudioChunk[] = [];
    let config: AudioDecoderConfig | null = null;

    return new Promise((resolve, reject) => {
        demuxer.onReady = (info: any) => {
            const audioTrack = info.tracks.find((t: any) => t.codec.startsWith('mp4a'));
            if (!audioTrack) {
                return reject(new Error("No AAC audio track found in the file."));
            }

            const track = demuxer.getTrackById(audioTrack.id);
            const description = new DataView(track.description.buffer);
            config = {
                codec: audioTrack.codec,
                sampleRate: audioTrack.audio.sample_rate,
                numberOfChannels: audioTrack.audio.channel_count,
                // description: track.description,
            };

            demuxer.setExtractionOptions(audioTrack.id, null, { nbSamples: 100 });
            demuxer.start();
        };

        demuxer.onSamples = (trackId, ref, samples) => {
            for (const sample of samples) {
                chunks.push(new EncodedAudioChunk({
                    type: sample.is_sync ? 'key' : 'delta',
                    timestamp: sample.cts,
                    duration: sample.duration,
                    data: sample.data,
                }));
            }
        };

        demuxer.onMoovEnd = () => {
            if (config) {
                resolve({ chunks, config });
            } else {
                reject(new Error("Audio track configuration not found."));
            }
        };

        const reader = file.stream().getReader();
        let offset = 0;

        function push() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    demuxer.flush();
                    return;
                }
                const buffer = value.buffer as any;
                buffer.fileStart = offset;
                offset += buffer.byteLength;
                demuxer.appendBuffer(buffer);
                push();
            }).catch(reject);
        }

        push();
    });
}

export async function transcode(
    file: File,
    config: any,
    totalFrames: number,
    onProgress: (progress: number, status: string) => void,
    signal?: AbortSignal
): Promise<{ video: Blob, audio: Blob | null }> {
    const videoProgressMax = config.audio.action === 'transcode' ? 0.5 : 1;
    const audioProgressMax = 1 - videoProgressMax;

    const videoPromise = transcodeVideo(file, {
        codec: config.video.codec,
        bitrate: config.video.bitrate,
        avc: { format: 'annexb' },
    }, totalFrames, (p) => onProgress(p * videoProgressMax, 'Encoding video...'), signal);

    let audioPromise: Promise<Blob | null> = Promise.resolve(null);
    if (config.audio.action === 'transcode') {
        audioPromise = transcodeAudio(file, {
            codec: config.audio.codec,
            bitrate: config.audio.bitrate,
            sampleRate: 48000,
            numberOfChannels: 2,
        }, (p) => onProgress(videoProgressMax + p * audioProgressMax, 'Encoding audio...'), signal);
    }

    const [video, audio] = await Promise.all([videoPromise, audioPromise]);

    return { video, audio };
}

export async function transcodeAudio(
    file: File,
    config: AudioEncoderConfig,
    onProgress: (progress: number) => void,
    signal?: AbortSignal,
): Promise<Blob> {
    const { chunks: audioChunks, config: decoderConfig } = await demuxAudioTrack(file);
    if (audioChunks.length === 0) {
        return new Blob([]);
    }

    const totalDuration = audioChunks.reduce((acc, chunk) => acc + (chunk.duration || 0), 0);
    let processedDuration = 0;

    const encodedChunks: ArrayBuffer[] = [];

    return new Promise(async (resolve, reject) => {
        const decoder = new AudioDecoder({
            output: (frame) => {
                encoder.encode(frame);
                frame.close();
            },
            error: (e) => reject(e),
        });

        await decoder.configure(decoderConfig);

        const encoder = new AudioEncoder({
            output: (chunk) => {
                const chunkData = new Uint8Array(chunk.byteLength);
                chunk.copyTo(chunkData);
                encodedChunks.push(chunkData.buffer);

                processedDuration += chunk.duration || 0;
                onProgress(processedDuration / totalDuration);
            },
            error: (e) => reject(e),
        });
        encoder.configure(config);

        for (const chunk of audioChunks) {
            if (signal?.aborted) {
                decoder.close();
                encoder.close();
                return reject(new Error('Aborted'));
            }
            decoder.decode(chunk);
        }

        await decoder.flush();
        await encoder.flush();

        const mimeType = config.codec === 'opus' ? 'audio/opus' : 'audio/aac';
        resolve(new Blob(encodedChunks, { type: mimeType }));
    });
}

export async function transcodeVideo(
    file: File,
    encoderConfig: VideoEncoderConfig,
    totalFrames: number,
    onProgress: (progress: number) => void,
    signal?: AbortSignal
): Promise<Blob> {
    console.log('Starting transcoding with config:', encoderConfig);

    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    video.muted = true;

    const chunks: ArrayBuffer[] = [];
    let processedFrames = 0;

    return new Promise((resolve, reject) => {
        video.onerror = () => {
            console.error('Video error:', video.error);
            reject(video.error || new Error('Video loading error'));
        };

        video.onloadedmetadata = async () => {
            console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight, 'Duration:', video.duration);
            try {
                encoderConfig.width = video.videoWidth;
                encoderConfig.height = video.videoHeight;

                const support = await VideoEncoder.isConfigSupported(encoderConfig);
                if (!support.supported) {
                    throw new Error(`Codec configuration not supported: ${JSON.stringify(encoderConfig)}`);
                }

                const isH264 = encoderConfig.codec.startsWith('avc1');
                const isVPX = encoderConfig.codec.startsWith('vp8') || encoderConfig.codec.startsWith('vp09');

                if (isVPX) {
                    const ivfHeader = generateIVFHeader({
                        codec: encoderConfig.codec,
                        width: video.videoWidth,
                        height: video.videoHeight
                    }, totalFrames, video.duration);
                    chunks.push(ivfHeader);
                }

                let firstChunk = true;
                const encoder = new VideoEncoder({
                    output: (chunk, metadata) => {
                        let data: Uint8Array;

                        const chunkData = new Uint8Array(chunk.byteLength);
                        chunk.copyTo(chunkData);

                        if (isH264) {
                            // Replace 4-byte lengths with start codes (0, 0, 0, 1)
                            let pos = 0;
                            while (pos + 4 < chunkData.length) {
                                const len = (chunkData[pos] << 24) | (chunkData[pos + 1] << 16) | (chunkData[pos + 2] << 8) | chunkData[pos + 3];
                                chunkData[pos] = 0;
                                chunkData[pos + 1] = 0;
                                chunkData[pos + 2] = 0;
                                chunkData[pos + 3] = 1;
                                pos += 4 + len;
                            }

                            if (firstChunk && metadata?.decoderConfig?.description) {
                                const header = getH264AnnexBHeaders(metadata.decoderConfig.description as ArrayBuffer);
                                const finalBuf = new Uint8Array(header.length + chunkData.length);
                                finalBuf.set(header, 0);
                                finalBuf.set(chunkData, header.length);
                                data = finalBuf;
                            } else {
                                data = chunkData;
                            }
                        } else if (isVPX) {
                            // Prepend IVF Frame Header
                            const ivfFrameHeader = new Uint8Array(12);
                            const view = new DataView(ivfFrameHeader.buffer);
                            view.setUint32(0, chunk.byteLength, true);
                            const pts = Math.round(chunk.timestamp / 1000); // ms
                            view.setUint32(4, pts & 0xffffffff, true);
                            view.setUint32(8, Math.floor(pts / 0x100000000), true);

                            const finalBuf = new Uint8Array(12 + chunk.byteLength);
                            finalBuf.set(ivfFrameHeader, 0);
                            finalBuf.set(chunkData, 12);
                            data = finalBuf;
                        } else {
                            data = chunkData;
                        }

                        const finalArrayBuffer = new ArrayBuffer(data.byteLength);
                        new Uint8Array(finalArrayBuffer).set(data);
                        chunks.push(finalArrayBuffer);
                        firstChunk = false;
                    },
                    error: (e) => {
                        console.error('Encoder error:', e);
                        reject(e);
                    },
                });

                encoder.configure(encoderConfig);

                const duration = video.duration;
                const frameInterval = duration / totalFrames;

                for (let i = 0; i < totalFrames; i++) {
                    if (signal?.aborted) {
                        throw new Error('Aborted');
                    }

                    const time = i * frameInterval;
                    video.currentTime = time;

                    await new Promise((r, rej) => {
                        video.onseeked = r;
                        if (signal) {
                            signal.addEventListener('abort', () => rej(new Error('Aborted')), { once: true });
                        }
                    });

                    const frame = new VideoFrame(video, { timestamp: time * 1_000_000 });

                    while (encoder.encodeQueueSize > 30) {
                        if (signal?.aborted) {
                            frame.close();
                            throw new Error('Aborted');
                        }
                        await new Promise(r => setTimeout(r, 10));
                    }

                    encoder.encode(frame);
                    frame.close();

                    processedFrames++;
                    if (processedFrames % 10 === 0) {
                        onProgress(Math.min(0.99, processedFrames / totalFrames));
                    }
                }

                console.log('Flushing encoder...');
                await encoder.flush();
                onProgress(1);
                console.log('Transcoding complete');

                resolve(new Blob(chunks));

            } catch (e) {
                console.error('Transcoding error:', e);
                reject(e);
            } finally {
                URL.revokeObjectURL(videoUrl);
            }
        };
    });
}
