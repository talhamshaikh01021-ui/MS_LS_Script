import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './tests',
  /* Run tests simultaneously in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retries */
  retries: 0,
  /* Run both desktop and mobile master suites simultaneously */
  workers: 2,
  /* Reporter to use */
  reporter: process.env.CI
    ? [
      ['list'],
      ['html', { open: 'never' }],
      ['github']
    ]
    : [
      ['list'],
      ['html', { open: 'never' }]
    ],
  globalSetup: path.resolve(__dirname, 'utils/global_setup.ts'),
  globalTeardown: path.resolve(__dirname, 'utils/global_teardown.ts'),
  timeout: 900000, // 15 minutes per test
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    actionTimeout: 20000,
    navigationTimeout: 45000,
  },
  projects: [
    {
      name: 'Desktop Master Suite',
      testMatch: /desktop_master\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Mobile Master Suite',
      testMatch: /mobile_master\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    },
    {
      name: 'Share Review Suite',
      testMatch: /share_review\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
