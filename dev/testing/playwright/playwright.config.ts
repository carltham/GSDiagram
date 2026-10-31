// The UI tests: the real VS Code with the extension, driven by Playwright. Run them with npm run test:ui.

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  // Each test starts its own VS Code; several at once fight over the display and the CPU.
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/report' }]],
  outputDir: 'test-results/output',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
