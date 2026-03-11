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

export async function transcode(
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

                let support = await VideoEncoder.isConfigSupported(encoderConfig);
                if (!support.supported && encoderConfig.bitrateMode === 'quantizer') {
                    console.warn('quantizer bitrateMode not supported, falling back to variable');
                    encoderConfig.bitrateMode = 'variable';
                    if (!encoderConfig.bitrate) {
                        encoderConfig.bitrate = 2_000_000; // Fallback default 2Mbps
                    }
                    support = await VideoEncoder.isConfigSupported(encoderConfig);
                }

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
