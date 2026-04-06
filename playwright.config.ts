import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,

  use: {
    extraHTTPHeaders: {
      ...(process.env.LIFI_API_KEY
        ? { 'x-lifi-api-key': process.env.LIFI_API_KEY }
        : {}),
    },
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  projects: [
    {
      name: 'api',
      use: {},
    },
  ],
});
