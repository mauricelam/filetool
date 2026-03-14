import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Final DEX API Usage Verification', async ({ page }) => {
  await page.goto('http://localhost:8080/filetool/dexviewer/index.html');

  const filePath = path.resolve('dexviewer/dex-parser/resources/classes.dex');
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');

  await page.evaluate(({ base64 }) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const file = new File([bytes], 'classes.dex', { type: 'application/octet-stream' });
    window.postMessage({ action: 'respondFile', file }, '*');
  }, { base64 });

  await page.locator('.package-tree').waitFor({ timeout: 20000 });

  // 1. Show API Usages tab and search
  await page.locator('button:has-text("API Usages")').click();
  await page.locator('input[placeholder*="Search API usage"]').fill('java.lang.Object');
  await page.locator('button:has-text("Search")').click();
  await page.locator('.usage-results-header').waitFor({ timeout: 10000 });

  await page.screenshot({ path: 'final-usage-results.png' });

  // 2. Click a result and verify navigation
  const firstResult = page.locator('.usage-item').first();
  await firstResult.click();

  // Wait for expansion
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'final-navigated.png' });
});
