import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  use: {
    headless: true,
    viewport: { width: 1920, height: 1200 },
    ignoreHTTPSErrors: true,
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node serve.mts',
    port: 8080,
    timeout: 600 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
