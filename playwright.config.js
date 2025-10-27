// playwright.config.js
module.exports = {
  testDir: './tests/integration',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
};
