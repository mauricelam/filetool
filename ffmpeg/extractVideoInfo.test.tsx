import { parseFFmpegOutput, VideoInfo, formatFileSize, formatDuration, getVideoStream, getAudioStream, getFormattedDuration } from './videoInfo';

describe('FFmpeg Video Information Extraction', () => {

  describe('parseFFmpegOutput', () => {
    it('should parse Big Buck Bunny video information correctly', () => {
      const mockFFmpegOutput = `
ffmpeg version 6.0 Copyright (c) 2000-2023 the FFmpeg developers
  built with gcc 12.2.0 (GCC)
  configuration: --enable-cross-compile --target-os=none --arch=x86_32 --enable-gpl --enable-libx264 --enable-libx265 --enable-libvpx --enable-libwebp --enable-libmp3lame --enable-libfdk-aac --enable-libvorbis --enable-libfreetype --enable-libtheora --enable-libopus --enable-libxvid --enable-libaom --disable-programs --disable-doc --disable-debug --disable-runtime-cpudetect --disable-autodetect --disable-ffplay --disable-ffprobe --disable-asm --disable-stripping --nm=llvm-nm --ar=llvm-ar --ranlib=llvm-ranlib --cc=emcc --cxx=em++ --objcc=emcc --dep-cc=emcc
  libavutil      58.  2.100 / 58.  2.100
  libavcodec     60.  3.100 / 60.  3.100
  libavformat    60.  3.100 / 60.  3.100
  libavdevice    60.  1.100 / 60.  1.100
  libavfilter     9.  3.100 /  9.  3.100
  libswscale      7.  1.100 /  7.  1.100
  libswresample   4. 10.100 /  4. 10.100
  libpostproc    57.  1.100 / 57.  1.100
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'big_buck_bunny.mp4':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    compatible_brands: isomiso2avc1mp41
    encoder         : Lavf58.76.100
  Duration: 00:01:00.05, start: 0.000000, bitrate: 677 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 640x360, 612 kb/s, 23.96 fps, 23.96 tbr, 24k tbn (default)
      Metadata:
        handler_name    : VideoHandler
        vendor_id       : [0][0][0][0]
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 22050 Hz, stereo, fltp, 65 kb/s (default)
      Metadata:
        handler_name    : SoundHandler
        vendor_id       : [0][0][0][0]
At least one output file must be specified
`;

      const result = parseFFmpegOutput(mockFFmpegOutput);

      expect(result.format.duration).toBe('60.05');
      expect(result.format.format_name).toBe('mov,mp4,m4a,3gp,3g2,mj2');
      expect(result.streams).toHaveLength(2);
      
      const videoStream = result.streams.find((s: any) => s.codec_type === 'video');
      expect(videoStream).toBeDefined();
      expect(videoStream.codec_name).toBe('h264');
      expect(videoStream.pix_fmt).toBe('yuv420p');
      expect(videoStream.width).toBe(640);
      expect(videoStream.height).toBe(360);
      expect(videoStream.bit_rate).toBe(612000); // 612 kb/s converted to bits/s
      expect(videoStream.r_frame_rate).toBe('23.96');

      const audioStream = result.streams.find((s: any) => s.codec_type === 'audio');
      expect(audioStream).toBeDefined();
      expect(audioStream.codec_name).toBe('aac (LC) (mp4a / 0x6134706D)');
      expect(audioStream.bit_rate).toBe(65000); // 65 kb/s converted to bits/s
    });

    it('should handle missing video stream', () => {
      const mockFFmpegOutput = `
Input #0, wav, from 'audio.wav':
  Duration: 00:05:00.00, bitrate: 1411 kb/s
  Stream #0:0: Audio: pcm_s16le ([1][0][0][0] / 0x0001), 44100 Hz, stereo, s16, 1411 kb/s
`;

      const result = parseFFmpegOutput(mockFFmpegOutput);
      
      expect(result.streams).toHaveLength(1);
      const audioStream = result.streams.find((s: any) => s.codec_type === 'audio');
      expect(audioStream).toBeDefined();
      
      const videoStream = result.streams.find((s: any) => s.codec_type === 'video');
      expect(videoStream).toBeUndefined();
    });

    it('should handle malformed output gracefully', () => {
      const mockFFmpegOutput = 'Invalid output';
      const result = parseFFmpegOutput(mockFFmpegOutput);
      
      expect(result.streams).toEqual([]);
      expect(result.format).toEqual({});
    });
  });

  describe('parseFFmpegOutput with video info processing', () => {
    it('should parse and process Big Buck Bunny video information correctly', () => {
      const mockFFmpegOutput = `
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'big_buck_bunny.mp4':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    compatible_brands: isomiso2avc1mp41
    encoder         : Lavf58.76.100
  Duration: 00:01:00.05, start: 0.000000, bitrate: 677 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 640x360, 612 kb/s, 23.96 fps, 23.96 tbr, 24k tbn (default)
      Metadata:
        handler_name    : VideoHandler
        vendor_id       : [0][0][0][0]
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 22050 Hz, stereo, fltp, 65 kb/s (default)
      Metadata:
        handler_name    : SoundHandler
        vendor_id       : [0][0][0][0]
At least one output file must be specified
`;

      const result = parseFFmpegOutput(mockFFmpegOutput);
      
      // Extract video and audio stream information
      const videoStream = getVideoStream(result);
      const audioStream = getAudioStream(result);
      
      const durationStr = getFormattedDuration(result);

      // Verify parsed information matches expected output
      expect(durationStr).toBe('1:00'); // 60.05 seconds formatted as 1:00
      expect(videoStream?.width).toBe(640);
      expect(videoStream?.height).toBe(360);
      expect(result.format?.format_name).toBe('mov,mp4,m4a,3gp,3g2,mj2');
      expect(result.streams?.length).toBe(2);
      expect(videoStream?.codec_name).toBe('h264');
      expect(videoStream?.pix_fmt).toBe('yuv420p');
      expect(Math.round(videoStream?.bit_rate / 1000)).toBe(612);
      expect(parseFloat(videoStream?.r_frame_rate).toFixed(2)).toBe('23.96');
      expect(audioStream?.codec_name).toBe('aac (LC) (mp4a / 0x6134706D)');
      expect(Math.round(audioStream?.bit_rate / 1000)).toBe(65);
    });

    it('should handle missing video stream', () => {
      const mockFFmpegOutput = `
Input #0, wav, from 'audio.wav':
  Duration: 00:05:00.00, bitrate: 1411 kb/s
  Stream #0:0: Audio: pcm_s16le ([1][0][0][0] / 0x0001), 44100 Hz, stereo, s16, 1411 kb/s
`;

      const result = parseFFmpegOutput(mockFFmpegOutput);
      
      const videoStream = getVideoStream(result);
      const audioStream = getAudioStream(result);
      
      expect(result.streams?.length).toBe(1);
      expect(audioStream?.codec_name).toBe('pcm_s16le ([1][0][0][0] / 0x0001)');
      expect(videoStream).toBeUndefined();
    });

    it('should format file size correctly', () => {
      const testCases = [
        { bytes: 0, expected: '0 Bytes' },
        { bytes: 1024, expected: '1 KB' },
        { bytes: 1048576, expected: '1 MB' },
        { bytes: 5515264, expected: '5.26 MB' }, // Big Buck Bunny size
        { bytes: 1073741824, expected: '1 GB' }
      ];

      testCases.forEach(({ bytes, expected }) => {
        expect(formatFileSize(bytes)).toBe(expected);
      });
    });

    it('should format duration correctly', () => {
      const testCases = [
        { seconds: 60.05, expected: '1:00' },
        { seconds: 125.5, expected: '2:05' },
        { seconds: 3661, expected: '61:01' },
        { seconds: 30, expected: '0:30' }
      ];

      testCases.forEach(({ seconds, expected }) => {
        expect(formatDuration(seconds)).toBe(expected);
      });
    });
  });

  describe('Integration Test with Expected Output Format', () => {
    it('should produce output matching the expected format for Big Buck Bunny', () => {
      const basicInfo: VideoInfo = {
        name: 'big_buck_bunny.mp4',
        size: 5515264, // 5.26 MB
        type: 'video/mp4'
      };

      const mockFFmpegOutput = `
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'big_buck_bunny.mp4':
  Duration: 00:01:00.05, start: 0.000000, bitrate: 677 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 640x360, 612 kb/s, 23.96 fps, 23.96 tbr, 24k tbn (default)
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 22050 Hz, stereo, fltp, 65 kb/s (default)
`;

      const parsedResult = parseFFmpegOutput(mockFFmpegOutput);
      
      // Extract video and audio stream information
      const videoStream = getVideoStream(parsedResult);
      const audioStream = getAudioStream(parsedResult);

      // Expected output format validation
      const expectedOutput = {
        name: 'big_buck_bunny.mp4',
        size: '5.26 MB',
        type: 'video/mp4',
        duration: '1:00',
        resolution: '640 × 360',
        container: 'mov',
        streams: 2,
        videoCodec: 'h264',
        colorSpace: 'yuv420p',
        videoBitrate: '612 kbps',
        frameRate: '23.96 fps',
        audioCodec: 'aac (LC) (mp4a / 0x6134706D)',
        audioBitrate: '65 kbps'
      };

      // Format the actual result to match expected output format
      const formattedResult = {
        name: basicInfo.name,
        size: formatFileSize(basicInfo.size),
        type: basicInfo.type,
        duration: getFormattedDuration(parsedResult),
        resolution: `${videoStream?.width} × ${videoStream?.height}`,
        container: parsedResult.format?.format_name?.split(',')[0], // Take first format
        streams: parsedResult.streams?.length,
        videoCodec: videoStream?.codec_name,
        colorSpace: videoStream?.pix_fmt,
        videoBitrate: videoStream?.bit_rate ? `${Math.round(videoStream.bit_rate / 1000)} kbps` : undefined,
        frameRate: videoStream?.r_frame_rate ? `${parseFloat(videoStream.r_frame_rate).toFixed(2)} fps` : undefined,
        audioCodec: audioStream?.codec_name,
        audioBitrate: audioStream?.bit_rate ? `${Math.round(audioStream.bit_rate / 1000)} kbps` : undefined
      };

      expect(formattedResult.name).toBe(expectedOutput.name);
      expect(formattedResult.size).toBe(expectedOutput.size);
      expect(formattedResult.type).toBe(expectedOutput.type);
      expect(formattedResult.duration).toBe(expectedOutput.duration);
      expect(formattedResult.resolution).toBe(expectedOutput.resolution);
      expect(formattedResult.container).toBe(expectedOutput.container);
      expect(formattedResult.streams).toBe(expectedOutput.streams);
      expect(formattedResult.videoCodec).toBe(expectedOutput.videoCodec);
      expect(formattedResult.colorSpace).toBe(expectedOutput.colorSpace);
      expect(formattedResult.videoBitrate).toBe(expectedOutput.videoBitrate);
      expect(formattedResult.frameRate).toBe(expectedOutput.frameRate);
      expect(formattedResult.audioCodec).toBe(expectedOutput.audioCodec);
      expect(formattedResult.audioBitrate).toBe(expectedOutput.audioBitrate);
    });
  });
});
