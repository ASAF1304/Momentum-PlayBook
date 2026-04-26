import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
  },
  webServer: {
    command: 'cross-env PLAYWRIGHT_AUTH_BYPASS=true next dev -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 90_000,
    env: { PLAYWRIGHT_AUTH_BYPASS: 'true' },
  },
});
