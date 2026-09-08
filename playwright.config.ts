import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node scripts/e2e-server.mjs`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DEMO_MODE: 'true',
      NODE_ENV: 'production',
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        process.env.TEST_DATABASE_URL ??
        'postgresql://economics:economics@localhost:5433/economics_test?schema=public',
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-session-secret-not-for-production-use-only',
      APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY ?? 'ZTJlLXRlc3Qta2V5LTMyLWJ5dGVzLWxvbmchISEhIQ==',
    },
  },
});
