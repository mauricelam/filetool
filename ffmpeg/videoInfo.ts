// Extracted video info functions for testing
export function parseFFmpegOutput(output: string) {
    const info: any = { streams: [], format: {} };
    
    // Extract duration
    const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseFloat(durationMatch[3]);
        info.format.duration = (hours * 3600 + minutes * 60 + seconds).toString();
    }
    
    // Extract container format
    const formatMatch = output.match(/Input #0, ([^,]+(?:,[^,]+)*), from/);
    if (formatMatch) {
        info.format.format_name = formatMatch[1];
    }
    
    // Extract video stream info
    const videoMatch = output.match(/Stream #0:(\d+).*: Video: ([^\s(]+)(?:\s*\([^)]*\))?(?:\s*\([^)]*\))?,\s*([^,(]+)(?:\([^)]*\))?,\s*(\d+x\d+)[^,]*,\s*(\d+(?:\.\d+)?)\s*kb\/s,\s*(\d+(?:\.\d+)?)\s*fps/);
    if (videoMatch) {
        const videoStream = {
            codec_type: 'video',
            codec_name: videoMatch[2],
            pix_fmt: videoMatch[3],
            width: parseInt(videoMatch[4].split('x')[0]),
            height: parseInt(videoMatch[4].split('x')[1]),
            bit_rate: parseInt(videoMatch[5]) * 1000, // Convert kb/s to bits/s
            r_frame_rate: videoMatch[6] || '0'
        };
        info.streams.push(videoStream);
    }
    
    // Extract audio stream info
    const audioMatch = output.match(/Stream #0:(\d+).*: Audio: ([^,]+)[^,]*,\s*(\d+) Hz[^,]*(?:,\s*([^,]+))?.*?(\d+) kb\/s/);
    if (audioMatch) {
        const audioStream = {
            codec_type: 'audio',
            codec_name: audioMatch[2],
            sample_rate: audioMatch[3],
            bit_rate: parseInt(audioMatch[5]) * 1000
        };
        info.streams.push(audioStream);
    }
    
    return info;
}

export interface VideoInfo {
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

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Helper functions for parsed FFmpeg output
export function getVideoStream(parsedOutput: any) {
    return parsedOutput.streams?.find((s: any) => s.codec_type === 'video');
}

export function getAudioStream(parsedOutput: any) {
    return parsedOutput.streams?.find((s: any) => s.codec_type === 'audio');
}

export function getFormattedDuration(parsedOutput: any): string {
    const duration = parseFloat(parsedOutput.format?.duration || '0');
    return formatDuration(duration);
}

