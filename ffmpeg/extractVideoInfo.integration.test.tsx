import { extractVideoInfo } from './main';
import * as fs from 'fs';
import * as path from 'path';

// Mock the ffmpegUtils module to avoid import.meta issues in Jest
jest.mock('./ffmpegUtils');

describe('FFmpeg Integration Test with Real FFmpeg.wasm', () => {
  it('should extract video info from actual big_buck_bunny.mp4 using real FFmpeg', async () => {
    // This test uses the actual FFmpeg.wasm library and the real video file
    
    // Read the actual video file
    const videoPath = path.join(__dirname, 'example', 'big_buck_bunny.mp4');
    
    // Skip test if video file doesn't exist
    if (!fs.existsSync(videoPath)) {
      console.warn('Skipping real FFmpeg test - big_buck_bunny.mp4 not found');
      return;
    }

    const videoBuffer = fs.readFileSync(videoPath);
    const videoFile = new File([videoBuffer], 'big_buck_bunny.mp4', {
      type: 'video/mp4'
    });

    // This will take longer as it loads real FFmpeg
    const result = await extractVideoInfo(videoFile);

    // Verify the results match our expected format
    expect(result.info.name).toBe('big_buck_bunny.mp4');
    expect(result.info.type).toBe('video/mp4');
    expect(result.info.size).toBeGreaterThan(5000000); // Should be around 5.26MB
    expect(result.info.duration).toBe('1:00');
    expect(result.info.width).toBe(640);
    expect(result.info.height).toBe(360);
    expect(result.info.videoCodec).toBe('h264');
    expect(result.info.colorSpace).toBe('yuv420p');
    expect(result.info.videoBitrate).toBe('612 kbps');
    expect(result.info.framerate).toBe('23.96 fps');
    expect(result.info.audioCodec).toContain('aac');
    expect(result.info.audioBitrate).toBe('65 kbps');
    expect(result.info.container).toContain('mov');
    expect(result.info.streams).toBe(2);

    // Verify we got actual FFmpeg output
    expect(result.rawOutput).toContain('ffmpeg version');
    expect(result.rawOutput).toContain('Input #0');
    expect(result.rawOutput).toContain('Stream #0:0');
    expect(result.rawOutput).toContain('Stream #0:1');
  }, 30000); // 30 second timeout for FFmpeg loading

  it('should handle FFmpeg loading errors gracefully', async () => {
    // Create a mock file to test error handling
    const mockFile = new File(['invalid content'], 'invalid.mp4', {
      type: 'video/mp4'
    });

    const result = await extractVideoInfo(mockFile);

    // Should return basic info even if FFmpeg analysis fails
    expect(result.info.name).toBe('invalid.mp4');
    expect(result.info.type).toBe('video/mp4');
    expect(result.info.size).toBe(15); // Length of 'invalid content'
  }, 30000);
});
