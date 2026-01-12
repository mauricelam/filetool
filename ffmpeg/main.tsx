import { FFmpeg } from '@ffmpeg/ffmpeg';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getFFmpegCoreURL, getFFmpegWasmURL, getFFmpegWorkerURL } from './ffmpegUtils';
import { transcode } from './webcodecs';

if (window.parent) {
    window.parent.postMessage({ 'action': 'requestFile' })
}

window.onmessage = (e) => {
    if (e.data.action === 'respondFile') {
        handleFile(e.data.file)
    }
}

const OUTPUT = createRoot(document.getElementById('output') as HTMLElement)

async function loadFFmpeg() {
    const ffmpeg = new FFmpeg()
    ffmpeg.on('log', ({ message }) => { console.log(message) })
    console.log("SharedArrayBuffer:", window.SharedArrayBuffer)
    await ffmpeg.load({
        coreURL: getFFmpegCoreURL(!!window.SharedArrayBuffer),
        wasmURL: getFFmpegWasmURL(!!window.SharedArrayBuffer),
        workerURL: getFFmpegWorkerURL(!!window.SharedArrayBuffer)
    })
    return ffmpeg
}

async function handleFile(file: File) {
    OUTPUT.render(<TranscodeVideo file={file} />)
}

enum Format {
    Mp4 = 'mp4',
    Mkv = 'mkv',
    WebM = 'webm',
    Gif = 'gif',
    WebP = 'webp',
    Ogv = 'ogv',
    Mpeg1 = 'mpeg1',
    Mpeg2 = 'mpeg2',
    Original = 'original'
}

enum AudioCodec {
    Original = 'copy',
    AAC = 'aac',
    MP3 = 'libmp3lame',
    FLAC = 'flac',
    Vorbis = 'libvorbis',
}

enum VideoCodec {
    Original = 'copy',
    H264 = 'libx264',
    H265 = 'libx265',
    VP8 = 'libvpx',
    VP9 = 'libvpx-vp9',
    AV1 = 'libaom-av1',
}

const FORMAT_MIME: Record<string, string> = {
    'mp4': 'video/mp4',
    'mkv': 'video/matroska',
    'webm': 'video/webm',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'ogv': 'video/ogg',
    'mpeg1': 'video/mpeg',
    'mpeg2': 'video/mpeg',
}

type TranscodeResults = { [format: string]: undefined | number | File }

export async function extractVideoInfo(file: File): Promise<{ info: VideoInfo; rawOutput: string }> {
    const basicInfo: VideoInfo = {
        name: file.name,
        size: file.size,
        type: file.type
    };

    try {
        const ffmpeg = new FFmpeg();
        await ffmpeg.load({
            coreURL: getFFmpegCoreURL(!!window.SharedArrayBuffer),
            wasmURL: getFFmpegWasmURL(!!window.SharedArrayBuffer),
            workerURL: getFFmpegWorkerURL(!!window.SharedArrayBuffer)
        });

        await ffmpeg.writeFile(file.name, new Uint8Array(await file.arrayBuffer()));

        let logOutput = '';
        ffmpeg.on('log', ({ message }) => {
            logOutput += message + '\n';
        });

        await ffmpeg.exec(['-i', file.name]);

        console.log('ffmpeg output=', logOutput)

        const info = parseFFmpegOutput(logOutput);

        const videoStream = info.streams?.find((s: any) => s.codec_type === 'video');
        const audioStream = info.streams?.find((s: any) => s.codec_type === 'audio');

        const duration = parseFloat(info.format?.duration || '0');
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        return {
            info: {
                ...basicInfo,
                duration: durationStr,
                width: videoStream?.width,
                height: videoStream?.height,
                videoCodec: videoStream?.codec_name,
                audioCodec: audioStream?.codec_name,
                videoBitrate: videoStream?.bit_rate ? `${Math.round(videoStream.bit_rate / 1000)} kbps` : undefined,
                audioBitrate: audioStream?.bit_rate ? `${Math.round(audioStream.bit_rate / 1000)} kbps` : undefined,
                framerate: videoStream?.r_frame_rate ? `${parseFloat(videoStream.r_frame_rate).toFixed(2)} fps` : undefined,
                colorSpace: videoStream?.pix_fmt,
                container: info.format?.format_name,
                streams: info.streams?.length
            },
            rawOutput: logOutput
        };

    } catch (error) {
        console.error('FFmpeg analysis failed:', error);
        return { info: basicInfo, rawOutput: '' };
    }
}

export function parseFFmpegOutput(output: string) {
    const info: any = { streams: [], format: {} };

    const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseFloat(durationMatch[3]);
        info.format.duration = (hours * 3600 + minutes * 60 + seconds).toString();
    }

    const formatMatch = output.match(/Input #0, ([^,]+)/);
    if (formatMatch) {
        info.format.format_name = formatMatch[1];
    }

    const lines = output.split('\n');
    for (const line of lines) {
        if (line.includes('Stream #0') && line.includes('Video:')) {
            const codecMatch = line.match(/Video: ([^ ,(]+)/);
            const resMatch = line.match(/, (\d{2,5}x\d{2,5})/);
            const fpsMatch = line.match(/, (\d+(?:\.\d+)?)\s*fps/);
            const brMatch = line.match(/, (\d+(?:\.\d+)?)\s*kb\/s/);
            const pixMatch = line.match(/Video: [^,]+, ([^,]+)/);

            const videoStream = {
                codec_type: 'video',
                codec_name: codecMatch ? codecMatch[1] : undefined,
                pix_fmt: pixMatch ? pixMatch[1].trim() : undefined,
                width: resMatch ? parseInt(resMatch[1].split('x')[0]) : undefined,
                height: resMatch ? parseInt(resMatch[1].split('x')[1]) : undefined,
                bit_rate: brMatch ? parseInt(brMatch[1]) * 1000 : undefined,
                r_frame_rate: fpsMatch ? fpsMatch[1] : '0'
            };
            info.streams.push(videoStream);
        } else if (line.includes('Stream #0') && line.includes('Audio:')) {
            const codecMatch = line.match(/Audio: ([^ ,(]+)/);
            const brMatch = line.match(/, (\d+(?:\.\d+)?)\s*kb\/s/);
            const srMatch = line.match(/, (\d+)\s*Hz/);

            const audioStream = {
                codec_type: 'audio',
                codec_name: codecMatch ? codecMatch[1] : undefined,
                sample_rate: srMatch ? srMatch[1] : undefined,
                bit_rate: brMatch ? parseInt(brMatch[1]) * 1000 : undefined
            };
            info.streams.push(audioStream);
        }
    }

    return info;
}

interface VideoInfo {
    name: string;
    size: number;
    type: string;
    duration?: string;
    width?: number;
    height?: number;
    videoCodec?: string;
    audioCodec?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    framerate?: string;
    colorSpace?: string;
    profile?: string;
    container?: string;
    streams?: number;
    metadata?: { [key: string]: string };
}

interface VideoPreviewProps {
    file: File;
    error: string | null;
    videoInfo: VideoInfo;
    setVideoInfo: Dispatch<SetStateAction<VideoInfo>>;
}

function VideoPreview({ file, error, videoInfo, setVideoInfo }: VideoPreviewProps) {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
    const [rawFFmpegOutput, setRawFFmpegOutput] = useState<string>('');
    const [showRawOutput, setShowRawOutput] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement>(null);

    const analyzeVideoWithFFmpeg = async () => {
        try {
            setIsAnalyzing(true);
            const result = await extractVideoInfo(file);
            setVideoInfo(result.info);
            setRawFFmpegOutput(result.rawOutput);
        } catch (error) {
            console.error('Video analysis failed:', error);
            if (videoRef.current) {
                const video = videoRef.current;
                const minutes = Math.floor(video.duration / 60);
                const seconds = Math.floor(video.duration % 60);
                const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                setVideoInfo((prev: VideoInfo) => ({
                    ...prev,
                    duration: durationStr,
                    width: video.videoWidth,
                    height: video.videoHeight,
                    videoCodec: 'Unknown (analysis failed)',
                    audioCodec: 'Unknown (analysis failed)'
                }));
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    useEffect(() => {
        if (videoRef.current) {
            const video = videoRef.current;
            const handleLoadedMetadata = () => {
                analyzeVideoWithFFmpeg();
            };
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
            return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
    }, [file]);

    useEffect(() => {
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl);
        }

        const newUrl = URL.createObjectURL(file);
        setVideoUrl(newUrl);

        return () => {
            URL.revokeObjectURL(newUrl);
        };
    }, [file]);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div style={{ flex: 1, padding: '20px', borderRight: '1px solid #e0e0e0' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Video Preview</h3>

            <div style={{ marginBottom: '20px' }}>
                <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    style={{
                        width: '100%',
                        maxHeight: '300px',
                        border: '1px solid #ddd',
                        borderRadius: '8px'
                    }}
                />
            </div>

            <div style={{
                background: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
            }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Video Information</h4>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    {isAnalyzing && (
                        <div style={{ color: '#007bff', marginBottom: '10px', fontStyle: 'italic' }}>
                            Analyzing video with FFmpeg...
                        </div>
                    )}
                    <div><strong>Name:</strong> {videoInfo.name}</div>
                    <div><strong>Size:</strong> {formatFileSize(videoInfo.size)}</div>
                    <div><strong>Type:</strong> {videoInfo.type}</div>
                    {videoInfo.duration && <div><strong>Duration:</strong> {videoInfo.duration}</div>}
                    {videoInfo.width && videoInfo.height && (
                        <div><strong>Resolution:</strong> {videoInfo.width} × {videoInfo.height}</div>
                    )}
                    {videoInfo.container && <div><strong>Container:</strong> {videoInfo.container}</div>}
                    {videoInfo.streams && <div><strong>Streams:</strong> {videoInfo.streams}</div>}
                    {videoInfo.videoCodec && <div><strong>Video Codec:</strong> {videoInfo.videoCodec}</div>}
                    {videoInfo.profile && <div><strong>Profile:</strong> {videoInfo.profile}</div>}
                    {videoInfo.colorSpace && <div><strong>Color Space:</strong> {videoInfo.colorSpace}</div>}
                    {videoInfo.videoBitrate && <div><strong>Video Bitrate:</strong> {videoInfo.videoBitrate}</div>}
                    {videoInfo.framerate && <div><strong>Frame Rate:</strong> {videoInfo.framerate}</div>}
                    {videoInfo.audioCodec && <div><strong>Audio Codec:</strong> {videoInfo.audioCodec}</div>}
                    {videoInfo.audioBitrate && <div><strong>Audio Bitrate:</strong> {videoInfo.audioBitrate}</div>}
                    {videoInfo.metadata && Object.keys(videoInfo.metadata).length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                            <strong>Metadata:</strong>
                            <div style={{ marginLeft: '10px', fontSize: '12px' }}>
                                {Object.entries(videoInfo.metadata).map(([key, value]) => (
                                    <div key={key}><em>{key}:</em> {value}</div>
                                ))}
                            </div>
                        </div>
                    )}
                    {rawFFmpegOutput && (
                        <div style={{ marginTop: '15px' }}>
                            <button
                                onClick={() => setShowRawOutput(!showRawOutput)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#007bff',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    textDecoration: 'underline',
                                    padding: 0,
                                    fontWeight: 'bold'
                                }}
                            >
                                {showRawOutput ? '▼' : '▶'} Raw FFmpeg Output
                            </button>
                            {showRawOutput && (
                                <div style={{
                                    marginTop: '10px',
                                    padding: '10px',
                                    background: '#f1f1f1',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    wordBreak: 'break-all'
                                }}>
                                    {rawFFmpegOutput}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div style={{
                    color: '#dc3545',
                    background: '#f8d7da',
                    padding: '10px',
                    borderRadius: '4px',
                    marginTop: '15px',
                    fontSize: '14px'
                }}>
                    <strong>Error:</strong> {error}
                </div>
            )}
        </div>
    );
}

interface TranscodeControlsProps {
    file: File;
    current: Format;
    setCurrent: (format: Format) => void;
    audioCodec: AudioCodec;
    setAudioCodec: (codec: AudioCodec) => void;
    videoCodec: VideoCodec;
    setVideoCodec: (codec: VideoCodec) => void;
    results: TranscodeResults;
    isFFmpegLoading: boolean;
    running: boolean;
    commandString: string;
    onTranscode: (format: Format) => void;
    onStop: () => void;
    onDownload: (file: File) => void;
    onCustomCommand: (command: string) => void;
    useWebCodecs: boolean;
    setUseWebCodecs: (value: boolean) => void;
}

function TranscodeControls({
    file,
    current,
    setCurrent,
    audioCodec,
    setAudioCodec,
    videoCodec,
    setVideoCodec,
    results,
    isFFmpegLoading,
    running,
    commandString,
    onTranscode,
    onStop,
    onDownload,
    onCustomCommand,
}: TranscodeControlsProps) {
    const [customCommand, setCustomCommand] = useState('');
    const [isEditingCommand, setIsEditingCommand] = useState(false);
    const [transcodedUrl, setTranscodedUrl] = useState<string>('');

    useEffect(() => {
        if (transcodedUrl) {
            URL.revokeObjectURL(transcodedUrl);
        }

        let newUrl = '';
        if (current !== Format.Original && results[current] instanceof Blob) {
            newUrl = URL.createObjectURL(results[current] as Blob);
        }

        setTranscodedUrl(newUrl);

        return () => {
            if (newUrl) {
                URL.revokeObjectURL(newUrl);
            }
        };
    }, [current, results]);

    const handleTranscode = () => {
        if (isEditingCommand && customCommand.trim()) {
            onCustomCommand(customCommand.trim());
        } else {
            onTranscode(current);
        }
    };

    const handleEditCommand = () => {
        setCustomCommand(commandString.replace('ffmpeg ', ''));
        setIsEditingCommand(true);
    };

    const handleSaveCommand = () => {
        setIsEditingCommand(false);
    };

    const handleCancelEdit = () => {
        setCustomCommand('');
        setIsEditingCommand(false);
    };

    return (
        <div style={{ flex: 1, padding: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Transcode Options</h3>

            {current !== Format.Original && results[current] instanceof File && (
                <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Transcoded Preview</h4>
                    <div style={{ marginBottom: '15px' }}>
                        {(current === Format.Gif || current === Format.WebP) ? (
                            <img
                                src={transcodedUrl}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '200px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px'
                                }}
                                alt="Transcoded Preview"
                            />
                        ) : (
                            <video
                                src={transcodedUrl}
                                controls
                                style={{
                                    width: '100%',
                                    maxHeight: '200px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px'
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="format-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Container Format:</label>
                <select
                    id="format-select"
                    onChange={(e) => setCurrent(e.target.value as Format)}
                    value={current}
                    style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da',
                        fontSize: '14px'
                    }}
                    disabled={isEditingCommand}
                >
                    {Object.values(Format).map(format => (
                        <option key={format} value={format}>{format.toUpperCase()}</option>
                    ))}
                </select>
            </div>

            {current !== Format.WebP && current !== Format.Gif && (
                <div style={{ marginBottom: '20px' }}>
                    <label htmlFor="audio-codec-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Audio Codec:</label>
                    <select
                        id="audio-codec-select"
                        onChange={(e) => setAudioCodec(e.target.value as AudioCodec)}
                        value={audioCodec}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ced4da',
                            fontSize: '14px'
                        }}
                        disabled={isEditingCommand}
                    >
                        {Object.values(AudioCodec).map(codec => (
                            <option key={codec} value={codec}>{codec === 'copy' ? 'Original' : codec.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
            )}

            {current !== Format.Gif && current !== Format.WebP && (
                <div style={{ marginBottom: '20px' }}>
                    <label htmlFor="video-codec-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Video Codec:</label>
                    <select
                        id="video-codec-select"
                        onChange={(e) => setVideoCodec(e.target.value as VideoCodec)}
                        value={videoCodec}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ced4da',
                            fontSize: '14px'
                        }}
                        disabled={isEditingCommand}
                    >
                        {Object.values(VideoCodec).map(codec => (
                            <option key={codec} value={codec}>{codec === 'copy' ? 'Original' : codec.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
            )}

            {commandString && (
                <div style={{
                    background: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '4px',
                    marginBottom: '20px',
                    border: '1px solid #e9ecef'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ fontSize: '14px' }}>FFmpeg Command:</strong>
                        {!isEditingCommand && (
                            <button
                                onClick={handleEditCommand}
                                style={{
                                    background: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                Edit
                            </button>
                        )}
                    </div>

                    {isEditingCommand ? (
                        <div>
                            <textarea
                                value={customCommand}
                                onChange={(e) => setCustomCommand(e.target.value)}
                                placeholder="Enter custom FFmpeg command (without 'ffmpeg' prefix)"
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ced4da',
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                    resize: 'vertical',
                                    marginBottom: '10px',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={handleSaveCommand}
                                    style={{
                                        background: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Save
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    style={{
                                        background: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                            {isEditingCommand && customCommand ? `ffmpeg ${customCommand}` : commandString}
                        </code>
                    )}
                </div>
            )}

            <div style={{ marginBottom: '20px' }}>
                <button
                    className="button"
                    onClick={running ? onStop : handleTranscode}
                    disabled={isFFmpegLoading || (!running && results[current] instanceof File) || (isEditingCommand && !customCommand.trim())}
                    style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: isFFmpegLoading || (!running && results[current] instanceof File) ? 'not-allowed' : 'pointer',
                        background: running ? '#dc3545' : '#28a745',
                        color: 'white'
                    }}
                >
                    {isFFmpegLoading ? 'Loading FFmpeg...' : running ? 'Stop Transcoding' : 'Start Transcoding'}
                </button>
            </div>

            {results[current] instanceof File && (
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="button"
                        onClick={() => onDownload(results[current] as File)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid #007bff',
                            background: '#007bff',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        Download
                    </button>
                </div>
            )}

            {typeof results[current] === 'number' && (
                <div style={{
                    background: '#e7f3ff',
                    padding: '10px',
                    borderRadius: '4px',
                    marginTop: '10px'
                }}>
                    <div style={{ fontSize: '14px', marginBottom: '5px' }}>Progress: {Math.round(results[current] as number * 100)}%</div>
                    <div style={{
                        width: '100%',
                        height: '8px',
                        background: '#ddd',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${(results[current] as number) * 100}%`,
                            height: '100%',
                            background: '#007bff',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}
        </div>
    );
}

function WebCodecsControls({
    file,
    onTranscode,
    running,
    results,
    onDownload,
    progress,
    status,
    hasVideo,
}: {
    file: File;
    onTranscode: (config: any) => void;
    running: boolean;
    results: TranscodeResults;
    onDownload: (file: File) => void;
    progress: number;
    status: string;
    hasVideo: boolean;
}) {
    const [videoCodec, setVideoCodec] = useState('vp09.00.51.08');
    const [bitrate, setBitrate] = useState(2_000_000);
    const [audioAction, setAudioAction] = useState('transcode'); // 'keep', 'transcode', 'remove'
    const [audioCodec, setAudioCodec] = useState('opus');
    const [audioBitrate, setAudioBitrate] = useState(128_000);
    const [container, setContainer] = useState('mp4');
    const [transcodedFile, setTranscodedFile] = useState<File | null>(null);
    const [transcodedUrl, setTranscodedUrl] = useState<string>('');

    useEffect(() => {
        if (videoCodec.startsWith('avc1')) {
            setContainer('mp4');
        } else if (videoCodec.startsWith('vp')) {
            setContainer('webm');
        }
    }, [videoCodec]);

    useEffect(() => {
        if (results) {
            const webCodecResults = Object.entries(results)
                .filter(([key, value]) => key.startsWith('webcodecs-') && value instanceof File)
                .map(([, value]) => value as File);

            if (webCodecResults.length > 0) {
                const lastTranscoded = webCodecResults[webCodecResults.length - 1];
                setTranscodedFile(lastTranscoded);
                const newUrl = URL.createObjectURL(lastTranscoded);
                setTranscodedUrl(newUrl);
                return () => URL.revokeObjectURL(newUrl);
            }
        }
    }, [results]);

    const handleTranscode = () => {
        const config = {
            video: {
                codec: videoCodec,
                bitrate: bitrate,
            },
            audio: {
                action: audioAction,
                codec: audioCodec,
                bitrate: audioBitrate,
            },
            container: container,
        };
        onTranscode(config);
    };

    return (
        <div style={{ flex: 1, padding: '20px' }}>
            {transcodedFile && (
                <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Transcoded Preview</h4>
                    <div style={{ marginBottom: '15px' }}>
                        <video
                            src={transcodedUrl}
                            controls
                            style={{
                                width: '100%',
                                maxHeight: '200px',
                                border: '1px solid #ddd',
                                borderRadius: '8px'
                            }}
                        />
                    </div>
                </div>
            )}
            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="video-codec-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Video Codec:</label>
                <select id="video-codec-select" value={videoCodec} onChange={e => setVideoCodec(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da',
                        fontSize: '14px'
                    }}
                    disabled={!hasVideo}
                >
                    <option value="vp8">VP8</option>
                    <option value="vp09.00.51.08">VP9</option>
                    <option value="avc1.42E033">H.264</option>
                </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="container-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Container Format:</label>
                <select id="container-select" value={container} onChange={e => setContainer(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da',
                        fontSize: '14px'
                    }}
                    disabled={!hasVideo}
                >
                    {videoCodec.startsWith('avc1') ? (
                        <>
                            <option value="mp4">MP4</option>
                            <option value="mov">MOV (QuickTime)</option>
                            <option value="mkv">MKV (Matroska)</option>
                        </>
                    ) : (
                        <>
                            <option value="webm">WebM</option>
                            <option value="mkv">MKV (Matroska)</option>
                        </>
                    )}
                </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="bitrate-input" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Bitrate:</label>
                <input id="bitrate-input" type="number" value={bitrate} onChange={e => setBitrate(parseInt(e.target.value, 10))}
                    style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da',
                        fontSize: '14px'
                    }}
                    disabled={!hasVideo}
                />
            </div>
            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="audio-action-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Audio:</label>
                <select id="audio-action-select" value={audioAction} onChange={e => setAudioAction(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ced4da',
                        fontSize: '14px'
                    }}
                >
                    <option value="keep">Keep original audio track</option>
                    <option value="transcode">Transcode audio track</option>
                    <option value="remove">Remove audio track</option>
                </select>
            </div>

            {audioAction === 'transcode' && (
                <>
                    <div style={{ marginBottom: '20px' }}>
                        <label htmlFor="audio-codec-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Audio Codec:</label>
                        <select id="audio-codec-select" value={audioCodec} onChange={e => setAudioCodec(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid #ced4da',
                                fontSize: '14px'
                            }}
                        >
                            <option value="opus">Opus</option>
                            <option value="aac">AAC</option>
                        </select>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label htmlFor="audio-bitrate-input" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Audio Bitrate:</label>
                        <input id="audio-bitrate-input" type="number" value={audioBitrate} onChange={e => setAudioBitrate(parseInt(e.target.value, 10))}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid #ced4da',
                                fontSize: '14px'
                            }}
                        />
                    </div>
                </>
            )}
            {running && (
                <div style={{
                    background: '#e7f3ff',
                    padding: '10px',
                    borderRadius: '4px',
                    marginTop: '10px'
                }}>
                    <div style={{ fontSize: '14px', marginBottom: '5px' }}>{status} {Math.round(progress * 100)}%</div>
                    <div style={{
                        width: '100%',
                        height: '8px',
                        background: '#ddd',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progress * 100}%`,
                            height: '100%',
                            background: '#007bff',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}
            <div style={{ marginBottom: '20px', marginTop: '10px' }}>
                <button onClick={handleTranscode} disabled={running}
                    style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: running ? 'not-allowed' : 'pointer',
                        background: running ? '#dc3545' : '#28a745',
                        color: 'white'
                    }}
                >
                    {running ? 'Transcoding...' : 'Transcode'}
                </button>
            </div>
            {transcodedFile && (
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="button"
                        onClick={() => onDownload(transcodedFile)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid #007bff',
                            background: '#007bff',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        Download
                    </button>
                </div>
            )}
        </div>
    );
}

function TranscodeVideo({ file }: { file: File }) {
    const [current, setCurrent] = useState<Format>(Format.Original)
    const [audioCodec, setAudioCodec] = useState<AudioCodec>(AudioCodec.Original)
    const [videoCodec, setVideoCodec] = useState<VideoCodec>(VideoCodec.Original)
    const [results, setResults] = useState<TranscodeResults>({ [Format.Original]: file })
    const [isFFmpegLoading, setIsFFmpegLoading] = useState<boolean>(false)
    const [running, setRunning] = useState<boolean>(false)
    const [commandString, setCommandString] = useState<string>("")
    const [error, setError] = useState<string | null>(null)
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [useWebCodecs, setUseWebCodecs] = useState<boolean>(false)
    const [webCodecsProgress, setWebCodecsProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [videoInfo, setVideoInfo] = useState<VideoInfo>({
        name: file.name,
        size: file.size,
        type: file.type
    });

    const parseDurationToSeconds = (duration: string | undefined): number => {
        if (!duration) return 0;
        const parts = duration.split(':').map(val => parseFloat(val));
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return parts[0] || 0;
    };

    const parseFramerate = (framerate: string | undefined): number => {
        if (!framerate) return 0;
        return parseFloat(framerate) || 0;
    };

    const handleWebCodecsTranscode = async (config: any) => {
        setRunning(true);
        setWebCodecsProgress(0);
        setError(null);
        const ffmpeg = await loadFFmpegInstance();
        if (!ffmpeg) {
            setError("Failed to load ffmpeg");
            setRunning(false);
            return;
        }

        try {
            await ffmpeg.writeFile(file.name, new Uint8Array(await file.arrayBuffer()));

            if (videoInfo.videoCodec) {
                const durationInSeconds = parseDurationToSeconds(videoInfo.duration);
                const framerate = parseFramerate(videoInfo.framerate);
                const totalFrames = Math.ceil(durationInSeconds * framerate);

                setStatus('Encoding video...');
            abortControllerRef.current = new AbortController();
            const encodedVideo = await transcode(
                file,
                {
                    codec: config.video.codec,
                    bitrate: config.video.bitrate,
                    avc: { format: 'annexb' },
                },
                totalFrames,
                (p) => setWebCodecsProgress(p),
                abortControllerRef.current.signal
            );

            const videoInputFile = `video-temp.${getExtensionForCodec(config.video.codec)}`;
            await ffmpeg.writeFile(videoInputFile, new Uint8Array(await encodedVideo.arrayBuffer()));

            const audioInputFile = `audio-temp.${config.audio.codec}`;
            if (config.audio.action === 'transcode') {
                setStatus('Transcoding audio...');
                await ffmpeg.exec(['-i', file.name, '-vn', '-c:a', config.audio.codec, '-b:a', config.audio.bitrate, audioInputFile]);
            } else if (config.audio.action === 'keep') {
                setStatus('Extracting audio...');
                await ffmpeg.exec(['-i', file.name, '-vn', '-c:a', 'copy', audioInputFile]);
            }

            const outputFileName = `output-webcodecs.${config.container || getContainerForCodec(config.video.codec)}`;
            const inputFormat = config.video.codec.startsWith('avc1') ? 'h264' : 'ivf';
            const inputFramerate = parseFramerate(videoInfo.framerate) || 30;

            const muxerArgs = ['-r', inputFramerate.toString(), '-f', inputFormat, '-i', videoInputFile];
            if (config.audio.action !== 'remove') {
                muxerArgs.push('-i', audioInputFile);
                muxerArgs.push('-map', '0:v:0', '-map', '1:a:0');
            } else {
                muxerArgs.push('-map', '0:v:0');
            }
            muxerArgs.push('-c', 'copy', '-strict', '-2', '-y', outputFileName);

            const result = await ffmpeg.exec(muxerArgs);
            if (result !== 0) {
                let hint = "";
                if (config.video.codec.startsWith('vp') && config.container === 'mp4') {
                    hint = " Note: VP8/VP9 are not natively supported in MP4 containers. Try using WebM or MKV instead.";
                } else if (config.video.codec.startsWith('avc1') && config.container === 'webm') {
                    hint = " Note: H.264 is not natively supported in WebM containers. Try using MP4 or MOV instead.";
                }
                throw new Error(`FFmpeg muxing failed (code ${result}).${hint}`);
            }

            setStatus('Reading output...');
            const data = await ffmpeg.readFile(outputFileName) as Uint8Array;
            const finalExtension = config.container || getContainerForCodec(config.video.codec);
            const resultFile = new File([data as any], outputFileName, { type: `video/${finalExtension}` });
            setResults(f => ({ ...f, [`webcodecs-${Date.now()}`]: resultFile }));

            // Cleanup
            try {
                await ffmpeg.deleteFile(videoInputFile);
                if (config.audio.action !== 'remove') {
                    await ffmpeg.deleteFile(audioInputFile);
                }
                await ffmpeg.deleteFile(outputFileName);
            } catch (cleanupError) {
                console.warn('Cleanup failed:', cleanupError);
            }
        } else if (videoInfo.audioCodec) {
            if (config.audio.action === 'remove') {
                setError("Cannot remove audio from an audio-only file.");
                return;
            }
            // Audio-only file
            const audioInputFile = `audio-temp.${config.audio.codec}`;
            if (config.audio.action === 'transcode') {
                setStatus('Transcoding audio...');
                await ffmpeg.exec(['-i', file.name, '-vn', '-c:a', config.audio.codec, '-b:a', config.audio.bitrate, audioInputFile]);
            } else if (config.audio.action === 'keep') {
                setStatus('Extracting audio...');
                await ffmpeg.exec(['-i', file.name, '-vn', '-c:a', 'copy', audioInputFile]);
            }

            const outputFileName = `output-webcodecs.${config.audio.codec}`;
            await ffmpeg.rename(audioInputFile, outputFileName);

            setStatus('Reading output...');
            const data = await ffmpeg.readFile(outputFileName) as Uint8Array;
            const finalExtension = config.audio.codec;
            const resultFile = new File([data as any], outputFileName, { type: `audio/${finalExtension}` });
            setResults(f => ({ ...f, [`webcodecs-${Date.now()}`]: resultFile }));

            // Cleanup
            try {
                await ffmpeg.deleteFile(outputFileName);
            } catch (cleanupError) {
                console.warn('Cleanup failed:', cleanupError);
            }
        }

        } catch (e: any) {
            console.error('WebCodecs Error:', e);
            const message = e instanceof Error ? e.message : String(e);
            setError(message);
            setStatus(`Error: ${message}`);
        } finally {
            setRunning(false);
            setWebCodecsProgress(0);
            setStatus('');
        }
    };

    const getExtensionForCodec = (codec: string) => {
        if (codec.startsWith('avc1')) {
            return 'h264';
        }
        if (codec.startsWith('vp09') || codec.startsWith('vp8')) {
            return 'ivf';
        }
        throw new Error(`Unsupported codec: ${codec}`);
    }

    const getContainerForCodec = (codec: string) => {
        if (codec.startsWith('avc1')) {
            return 'mp4';
        }
        return 'webm';
    }

    const generateFfmpegCommand = (format: Format, audioCodec: AudioCodec, fileName: string, outputFileName: string) => {
        let ffmpegCommand: string[] = [
            '-i', fileName,
        ]

        if (format === Format.WebM) {
            ffmpegCommand.push("-fflags", "+genpts")
        }

        if (audioCodec !== AudioCodec.Original) {
            ffmpegCommand.push('-c:a', audioCodec)
        }

        if (format !== Format.Gif) {
            ffmpegCommand.push("-crf", "23")
            ffmpegCommand.push('-c:v', videoCodec)
        }

        if (format === Format.Gif) {
            ffmpegCommand.push(
                '-vf', 'fps=10,scale=320:-1:flags=lanczos',
                '-c:v', 'gif',
                outputFileName
            )
        } else if (format === Format.WebP) {
            ffmpegCommand.push(
                '-vf', 'scale=iw/2:ih/2',
                '-c:v', 'libwebp',
                '-lossless', '1',
                outputFileName
            )
        } else if (format === Format.Ogv) {
            ffmpegCommand.push(
                '-c:v', 'libtheora',
                '-c:a', 'libvorbis',
                outputFileName
            )
        } else if (format === Format.Mpeg1) {
            ffmpegCommand.push(
                '-c:v', 'mpeg1video',
                '-q:v', '5',
                outputFileName
            )
        } else if (format === Format.Mpeg2) {
            ffmpegCommand.push(
                '-c:v', 'mpeg2video',
                '-q:v', '5',
                outputFileName
            )
        } else {
            ffmpegCommand.push(
                outputFileName,
                '-threads', '0',
                '-preset', 'ultrafast'
            )
        }
        return `ffmpeg ${ffmpegCommand.join(' ')}`
    }

    useEffect(() => {
        if (file) {
            const outputFileName = `output.${current}`
            setCommandString(generateFfmpegCommand(current, audioCodec, file.name, outputFileName))
        }
    }, [current, audioCodec, file])

    const loadFFmpegInstance = async () => {
        setIsFFmpegLoading(true)
        const ffmpeg = await loadFFmpeg()
        ffmpegRef.current = ffmpeg;
        setIsFFmpegLoading(false)
        return ffmpeg
    }

    const stopTranscoding = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (ffmpegRef.current) {
            ffmpegRef.current.terminate();
            ffmpegRef.current = null;
        }
        setResults(f => ({ ...f, [current]: undefined }));
        setIsFFmpegLoading(false);
        setRunning(false);
    }

    const transcode = async (format: Format) => {
        try {
            setCurrent(_ => format)
            setRunning(true)
            const ffmpeg = await loadFFmpegInstance()
            const onprogress = ({ progress, time }: { progress: number; time: number }) => {
                console.log(`Progress: ${progress}, Time: ${time}`);
                setResults(f => ({ ...f, [format]: progress }))
            }
            ffmpeg.on('progress', onprogress)
            const outputFileName = `output.${format}`
            let ffmpegCommand: string[] = [
                '-i', file.name,
            ]

            if (format === Format.WebM) {
                ffmpegCommand.push("-fflags", "+genpts")
            }

            if (audioCodec !== AudioCodec.Original) {
                ffmpegCommand.push('-c:a', audioCodec)
            }

            if (format !== Format.Gif) {
                ffmpegCommand.push("-crf", "23")
                ffmpegCommand.push('-c:v', videoCodec)
            }

            if (format === Format.Gif) {
                ffmpegCommand.push(
                    '-vf', 'fps=10,scale=320:-1:flags=lanczos',
                    '-c:v', 'gif',
                    outputFileName
                )
            } else if (format === Format.WebP) {
                ffmpegCommand.push(
                    '-vf', 'scale=iw/2:ih/2',
                    '-c:v', 'libwebp',
                    '-lossless', '1',
                    outputFileName
                )
            } else if (format === Format.Ogv) {
                ffmpegCommand.push(
                    '-c:v', 'libtheora',
                    '-c:a', 'libvorbis',
                    outputFileName
                )
            } else if (format === Format.Mpeg1) {
                ffmpegCommand.push(
                    '-c:v', 'mpeg1video',
                    '-q:v', '5',
                    outputFileName
                )
            } else if (format === Format.Mpeg2) {
                ffmpegCommand.push(
                    '-c:v', 'mpeg2video',
                    '-q:v', '5',
                    outputFileName
                )
            } else {
                ffmpegCommand.push(
                    outputFileName,
                    '-threads', format === Format.WebM ? '0' : '2',
                    '-preset', 'ultrafast'
                )
            }
            await ffmpeg.writeFile(file.name, new Uint8Array(await file.arrayBuffer()))
            await ffmpeg.exec(ffmpegCommand)
            const data = await ffmpeg.readFile(outputFileName) as Uint8Array
            setResults(f => ({ ...f, [format]: new File([data as any], outputFileName, { type: FORMAT_MIME[format] }) }))
            ffmpeg.off('progress', onprogress)
            setRunning(false)
        } catch (e: any) {
            setError(e instanceof Error ? e.message : String(e))
        }
    }

    const download = (file: File) => {
        const url = URL.createObjectURL(file)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = file.name
        anchor.click()
    }

    function url(): string {
        const transcoded = results[current]
        return transcoded instanceof Blob ?
            URL.createObjectURL(transcoded) : ''
    }

    const handleCustomCommand = async (command: string) => {
        try {
            setRunning(true)
            const ffmpeg = await loadFFmpegInstance()
            const onprogress = ({ progress, time }: { progress: number; time: number }) => {
                console.log(`Progress: ${progress}, Time: ${time}`)
                setResults(f => ({ ...f, [current]: progress }))
            }
            ffmpeg.on('progress', onprogress)

            const args = command.split(' ').filter(arg => arg.trim() !== '')
            await ffmpeg.writeFile(file.name, new Uint8Array(await file.arrayBuffer()))
            await ffmpeg.exec(args)

            const files = await ffmpeg.listDir('/')
            const outputFile = files.find(f => f.name !== file.name && !f.name.endsWith('/'))

            if (outputFile) {
                const data = await ffmpeg.readFile(outputFile.name) as Uint8Array
                const outputFormat = outputFile.name.split('.').pop() || 'output'
                const mimeType = FORMAT_MIME[outputFormat] || 'application/octet-stream'
                setResults(f => ({ ...f, [current]: new File([data as any], outputFile.name, { type: mimeType }) }))
            }

            ffmpeg.off('progress', onprogress)
            setRunning(false)
        } catch (e: any) {
            setError(e instanceof Error ? e.message : String(e))
            setRunning(false)
        }
    }

    const supportsWebCodecs = 'VideoEncoder' in window;

    return (
        <div style={{
            display: 'flex',
            width: '100%',
            minHeight: '600px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: '#ffffff',
            boxSizing: 'border-box'
        }}>
            <VideoPreview
                file={file}
                error={error}
                videoInfo={videoInfo}
                setVideoInfo={setVideoInfo}
            />
            <div style={{ flex: 1, padding: '20px' }}>
                {supportsWebCodecs && (
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={useWebCodecs}
                                onChange={(e) => setUseWebCodecs(e.target.checked)}
                                style={{ marginRight: '10px' }}
                            />
                            Use WebCodecs API for transcoding
                        </label>
                    </div>
                )}
                {useWebCodecs && supportsWebCodecs ? (
                    <WebCodecsControls
                        file={file}
                        onTranscode={handleWebCodecsTranscode}
                        running={running}
                        results={results}
                        onDownload={download}
                        progress={webCodecsProgress}
                        status={status}
                        hasVideo={!!videoInfo.videoCodec}
                    />
                ) : (
                    <TranscodeControls
                        file={file}
                        current={current}
                        setCurrent={setCurrent}
                        audioCodec={audioCodec}
                        setAudioCodec={setAudioCodec}
                        videoCodec={videoCodec}
                        setVideoCodec={setVideoCodec}
                        results={results}
                        isFFmpegLoading={isFFmpegLoading}
                        running={running}
                        commandString={commandString}
                        onTranscode={transcode}
                        onStop={stopTranscoding}
                        onDownload={download}
                        onCustomCommand={handleCustomCommand}
                        useWebCodecs={useWebCodecs}
                        setUseWebCodecs={setUseWebCodecs}
                    />
                )}
            </div>
        </div>
    )
}
