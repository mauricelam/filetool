import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils.ts';
import fs from 'node:fs';

test.setTimeout(120000); // 2 minutes

test('bloaty handler works', async ({ page }) => {
  const filePath = 'wat_viewer/example/hello_world_bg.wasm';
  const content = fs.readFileSync(filePath);

  const iframe = await runHandlerTest(page, {
    handler: 'bloaty',
    file: {
      content,
      name: 'hello_world_bg.wasm',
      type: 'application/wasm',
    },
  });

  // Try to find the title by text
  await expect(iframe.getByText('Bloaty Size Profiler')).toBeVisible({ timeout: 30000 });

  // Wait for Bloaty to finish
  const output = iframe.locator('pre');
  // Wait for the analyzing text to appear and then disappear or wait for content
  await expect(output).toHaveText(/Analyzing\.\.\./, { timeout: 30000 });
  await expect(output).not.toHaveText(/Analyzing\.\.\./, { timeout: 90000 });

  // Check text output
  const text = await output.textContent();
  console.log('Bloaty output length:', text?.length);
  expect(text?.length).toBeGreaterThan(100);

  await page.screenshot({ path: 'test-results/bloaty_text_final.png' });

  // Switch to treemap
  await iframe.click('button:has-text("Treemap")');
  await expect(iframe.locator('svg')).toBeVisible();
  await page.screenshot({ path: 'test-results/bloaty_treemap_final.png' });
});
