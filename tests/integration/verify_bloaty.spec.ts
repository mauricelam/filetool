import { test, expect } from '@playwright/test';
import { runHandlerTest } from './test-utils';
import fs from 'node:fs';

test.setTimeout(300000); // 5 minutes

test('bloaty handler works', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

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

  // Wait for it to not say "Analyzing..."
  await expect(output).not.toHaveText(/Analyzing\.\.\./, { timeout: 120000 });

  // Check text output
  const text = await output.textContent();
  expect(text?.length).toBeGreaterThan(100);
});
