import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    baseURL: 'http://localhost:8080',
  },
  webServer: {
    command: 'node serve.mjs',
    port: 8080,
    timeout: 600 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
