import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { runHandlerTest } from './test-utils';

test('ffmpeg viewer UI update', async ({ page }) => {
    // Increase timeout for this test
    test.setTimeout(60000);

    const filePath = path.resolve('ffmpeg/example/big_buck_bunny.mp4');
    // Use only a small portion of the file for UI verification to speed up the test
    const fileBuffer = fs.readFileSync(filePath).subarray(0, 100 * 1024);

    const iframe = await runHandlerTest(page, {
        handler: 'ffmpeg',
        file: {
            content: fileBuffer,
            name: 'big_buck_bunny.mp4',
            type: 'video/mp4'
        }
    });

    // Wait for the UI to load - increase timeout
    await expect(iframe.locator('h3').first()).toBeVisible({ timeout: 40000 });

    // Verify container format options
    const select = iframe.locator('#format-select');
    await expect(select).toBeVisible();

    // Select MP4 to enable WebCodecs checkbox
    await select.selectOption('mp4');

    // Check if (FFmpeg only) is present in the select options
    const options = await select.locator('option').allTextContents();
    console.log('Options:', options);
    expect(options.some(opt => opt.includes('(FFmpeg only)'))).toBe(true);

    // Verify WebCodecs checkbox position
    const webCodecsCheckboxLabel = iframe.locator('label', { hasText: 'Use WebCodecs API for transcoding' });
    await expect(webCodecsCheckboxLabel).toBeVisible();
    const webCodecsCheckbox = webCodecsCheckboxLabel.locator('input');

    // Verify Video Codec radio buttons
    const h264Label = iframe.locator('label', { hasText: 'LIBX264' });
    await expect(h264Label).toBeVisible();

    const h265Label = iframe.locator('label', { hasText: 'LIBX265' });
    await expect(h265Label).toBeVisible();
    expect(await h265Label.innerText()).toContain('(FFmpeg only)');

    // Test automatic unchecking
    await webCodecsCheckbox.check();
    await expect(webCodecsCheckbox).toBeChecked();

    // Select an FFmpeg-only codec
    await h265Label.click();
    await expect(webCodecsCheckbox).not.toBeChecked();
});
