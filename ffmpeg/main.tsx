import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

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
        coreURL: new URL(
            window.SharedArrayBuffer ? 'ffmpeg-core-mt.js' : 'ffmpeg-core.js',
            import.meta.url
        ).toString(),
        wasmURL: new URL(
            window.SharedArrayBuffer ? 'ffmpeg-core-mt.wasm' : 'ffmpeg-core.wasm',
            import.meta.url
        ).toString(),
        workerURL: window.SharedArrayBuffer ?
            new URL('ffmpeg-core-worker-mt.js', import.meta.url).toString() : ''
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

const FORMAT_MIME = {
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
        ffmpegRef.current = ffmpeg; // Store the ffmpeg instance
        setIsFFmpegLoading(false)
        return ffmpeg
    }

    const stopTranscoding = () => {
        if (ffmpegRef.current) {
            ffmpegRef.current.terminate();
            ffmpegRef.current = null; // Clear the ref
            setResults(f => ({ ...f, [current]: undefined })); // Reset progress/result
            setIsFFmpegLoading(false); // Ensure loading state is false
            setRunning(false); // Set running to false when stopped
        }
    }

    const transcode = async (format: Format) => {
        try {
            setCurrent(_ => format)
            setRunning(true) // Set running to true at the start
            const ffmpeg = await loadFFmpegInstance()
            const onprogress = ({ progress, time }) => {
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
            setResults(f => ({ ...f, [format]: new File([data.buffer], outputFileName, { type: FORMAT_MIME[format] }) }))
            ffmpeg.off('progress', onprogress)
            setRunning(false) // Set running to false at the end
        } catch (e) {
            setError(e.message)
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

    return (
        <>
            {isFFmpegLoading && <div>Loading FFmpeg...</div>}
            {(current === Format.Gif || current === Format.WebP) ? (
                <img src={url()} style={{ maxWidth: '100%', maxHeight: '400px' }} />
            ) : (
                <video src={url()} controls></video>
            )}
            {error && <div style={{ color: 'red', marginTop: '10px' }}>Error: {error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '10px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
                {commandString && <div style={{ fontSize: '0.8em', color: '#555' }}>
                    <p>Command: <code>{commandString}</code></p>
                </div>}
                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="format-select">Select Format:</label>
                    <select id="format-select" onChange={(e) => setCurrent(e.target.value as Format)} value={current} style={{ marginLeft: '5px', padding: '5px', borderRadius: '3px' }}>
                        {Object.values(Format).map(format => (
                            <option key={format} value={format}>{format}</option>
                        ))}
                    </select>
                </div>
                {current !== Format.WebP && current !== Format.Gif && (
                    <div style={{ marginBottom: '10px' }}>
                        <label htmlFor="audio-codec-select">Select Audio Codec:</label>
                        <select id="audio-codec-select" onChange={(e) => setAudioCodec(e.target.value as AudioCodec)} value={audioCodec} style={{ marginLeft: '5px', padding: '5px', borderRadius: '3px' }}>
                            {Object.values(AudioCodec).map(codec => (
                                <option key={codec} value={codec}>{codec}</option>
                            ))}
                        </select>
                    </div>
                )}
                {
                    <div style={{ marginBottom: '10px' }}>
                        {current !== Format.Gif && current !== Format.WebP && (
                            <>
                                <label htmlFor="video-codec-select">Select Video Codec:</label>
                                <select id="video-codec-select" onChange={(e) => setVideoCodec(e.target.value as VideoCodec)} value={videoCodec} style={{ marginLeft: '5px', padding: '5px', borderRadius: '3px' }}>
                                    {Object.values(VideoCodec).map(codec => (
                                        <option key={codec} value={codec}>{codec}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        {
                            <button
                                className="button"
                                onClick={running ? stopTranscoding : () => transcode(current)}
                                disabled={isFFmpegLoading || (!running && results[current] instanceof File)}
                            >
                                {running ? "Stop" : "Transcode"}
                            </button>
                        }
                    </div>
                }

                {results[current] instanceof File && (
                    <div style={{ marginTop: '10px' }}>
                        <button className="button" onClick={() => download(results[current] as File)}>Download</button>
                        <button className="button" onClick={() => setCurrent(Format.Original)}>View Original</button>
                    </div>
                )}
            </div>
        </>
    )
}
