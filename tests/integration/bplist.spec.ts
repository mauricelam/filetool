import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test('BplistViewer should display the content of a binary plist file', async ({ page }) => {
  await page.goto('/filetool/tests/integration/driver.html');

  const filePath = path.resolve(__dirname, '../fixtures/sample.plist');
  const buffer = fs.readFileSync(filePath);

  await page.evaluate(async ({ buffer }) => {
    const file = new File([buffer], 'sample.plist', { type: 'application/x-plist' });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    window.postMessage({
      action: 'setFile',
      files: dataTransfer.files,
      handler: 'bplistviewer'
    }, '*');
  }, { buffer });

  await page.waitForSelector('iframe');
  const iframe = await page.frameLocator('iframe');
  await expect(iframe.locator('text="some-key"')).toBeVisible();
  await expect(iframe.locator('text="some-value"')).toBeVisible();
});
